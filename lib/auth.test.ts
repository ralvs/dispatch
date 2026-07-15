import type { User } from "@supabase/supabase-js";
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
