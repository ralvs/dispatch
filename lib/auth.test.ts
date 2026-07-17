import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/env.ts caches its parsed result in a module-level variable, and
// lib/auth.ts reads OWNER_USER_ID through it — reset modules and re-import
// fresh each test so env changes actually take effect.
async function importIsOwner() {
	const mod = await import("@/lib/auth");
	return mod.isOwner;
}

const OWNER_ID = "84585218-bf6f-4077-b124-2c14db7f0b07";
const OTHER_ID = "4e167810-cae1-489d-9616-23ece10e1fea";

function fakeUser(id: string): User {
	return { id } as User;
}

describe("isOwner", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("fails closed when OWNER_USER_ID is unset, even for a user that would otherwise match", async () => {
		vi.stubEnv("OWNER_USER_ID", "");
		const isOwner = await importIsOwner();
		expect(isOwner(fakeUser(OWNER_ID))).toBe(false);
	});

	it("is false when there is no user", async () => {
		vi.stubEnv("OWNER_USER_ID", OWNER_ID);
		const isOwner = await importIsOwner();
		expect(isOwner(null)).toBe(false);
	});

	it("is true when the user id matches OWNER_USER_ID", async () => {
		vi.stubEnv("OWNER_USER_ID", OWNER_ID);
		const isOwner = await importIsOwner();
		expect(isOwner(fakeUser(OWNER_ID))).toBe(true);
	});

	it("is false when the user id does not match OWNER_USER_ID", async () => {
		vi.stubEnv("OWNER_USER_ID", OWNER_ID);
		const isOwner = await importIsOwner();
		expect(isOwner(fakeUser(OTHER_ID))).toBe(false);
	});
});

// requireOwner() calls cookies() and createServerClient() under the hood,
// neither of which work outside a real request scope — mock those two
// dependencies so ownerRoute's dispatch logic (call handler vs. return the
// auth failure) runs against the real requireOwner/isOwner implementation.
vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({ getAll: () => [] })),
}));

const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
	createServerClient: vi.fn(() => ({ auth: { getUser } })),
}));

async function importOwnerRoute() {
	const mod = await import("@/lib/auth");
	return mod.ownerRoute;
}

describe("ownerRoute", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
		vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		getUser.mockReset();
	});

	it("invokes the handler with the authorized user and client", async () => {
		vi.stubEnv("OWNER_USER_ID", OWNER_ID);
		getUser.mockResolvedValue({ data: { user: fakeUser(OWNER_ID) } });
		const ownerRoute = await importOwnerRoute();

		const handler = vi.fn().mockResolvedValue(new NextResponse(null, { status: 200 }));
		const route = ownerRoute(handler);
		const request = new Request("https://example.com");

		const response = await route(request);

		expect(handler).toHaveBeenCalledTimes(1);
		const [calledRequest, auth] = handler.mock.calls[0] as [
			Request,
			{ user: User; sb: SupabaseClient },
		];
		expect(calledRequest).toBe(request);
		expect(auth.user.id).toBe(OWNER_ID);
		expect(response.status).toBe(200);
	});

	it("returns the auth failure response without calling the handler", async () => {
		vi.stubEnv("OWNER_USER_ID", OWNER_ID);
		getUser.mockResolvedValue({ data: { user: fakeUser(OTHER_ID) } });
		const ownerRoute = await importOwnerRoute();

		const handler = vi.fn();
		const route = ownerRoute(handler);

		const response = await route(new Request("https://example.com"));

		expect(handler).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
	});
});
