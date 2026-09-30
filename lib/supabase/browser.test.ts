// @vitest-environment happy-dom
// @vitest-environment-options {"url":"http://localhost:3000/"}

import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

// The thin browser client only works if it writes the exact cookies that
// proxy.ts and requireOwner() read with createServerClient, and reads the ones
// they write (docs/adr/0067). A mismatch is a silent logout, so both
// directions go through the real @supabase/ssr server client.

const URL_ = "http://127.0.0.1:54321";
const KEY = "sb_publishable_test";

function readCookies() {
	return document.cookie
		.split("; ")
		.filter(Boolean)
		.map((pair) => {
			const i = pair.indexOf("=");
			return { name: pair.slice(0, i), value: decodeURIComponent(pair.slice(i + 1)) };
		});
}

/** Writes the jar the way @supabase/ssr's browser adapter does. */
function setCookie(name: string, value: string, maxAge: number) {
	// biome-ignore lint/suspicious/noDocumentCookie: the subject under test is document.cookie
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

/** The proxy's view: a server client over the browser's cookie jar. */
function serverClient() {
	return createServerClient(URL_, KEY, {
		cookieOptions: AUTH_COOKIE_OPTIONS,
		cookies: {
			getAll: readCookies,
			setAll(cookies) {
				for (const { name, value, options } of cookies) {
					setCookie(name, value, value ? (options.maxAge ?? 0) : 0);
				}
			},
		},
	});
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

function fakeSession() {
	const now = Math.floor(Date.now() / 1000);
	const claims = { sub: "00000000-0000-0000-0000-000000000001", exp: now + 3600, iat: now };
	return {
		// Unsigned, but shaped like a JWT: setSession decodes the claims.
		access_token: `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(claims)}.sig`,
		refresh_token: "refresh-token",
		token_type: "bearer",
		expires_in: 3600,
		expires_at: now + 3600,
		// Big enough that the cookie is chunked, like a real session.
		user: {
			id: "00000000-0000-0000-0000-000000000001",
			aud: "authenticated",
			role: "authenticated",
			email: "owner@example.com",
			app_metadata: { provider: "email", padding: "x".repeat(4000) },
			user_metadata: {},
			created_at: new Date().toISOString(),
		},
	};
}

async function loadBrowserAuth() {
	vi.resetModules();
	const { browserAuth } = await import("@/lib/supabase/browser");
	const auth = browserAuth();
	await auth.stopAutoRefresh();
	return auth;
}

beforeEach(() => {
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_);
	vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", KEY);
	for (const { name } of readCookies()) setCookie(name, "", 0);
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("browserAuth", () => {
	it("returns one browser-wide instance", async () => {
		vi.resetModules();
		const { browserAuth } = await import("@/lib/supabase/browser");
		expect(browserAuth()).toBe(browserAuth());
		await browserAuth().stopAutoRefresh();
	});

	it("writes a session the server client reads", async () => {
		const session = fakeSession();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(session), { status: 200 })),
		);
		const auth = await loadBrowserAuth();

		const { error } = await auth.signInWithPassword({ email: "owner@example.com", password: "x" });
		expect(error).toBeNull();

		// Same name and encoding createBrowserClient wrote, chunked.
		const first = readCookies().find((c) => c.name === "sb-127-auth-token.0");
		expect(first?.value.startsWith("base64-")).toBe(true);

		const { data } = await serverClient().auth.getSession();
		expect(data.session?.access_token).toBe(session.access_token);
		expect(data.session?.refresh_token).toBe(session.refresh_token);
	});

	it("reads a session the server client wrote", async () => {
		const session = fakeSession();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(JSON.stringify(session.user), { status: 200 })),
		);
		const server = serverClient();
		const { error } = await server.auth.setSession({
			access_token: session.access_token,
			refresh_token: session.refresh_token,
		});
		expect(error).toBeNull();

		const auth = await loadBrowserAuth();
		const { data } = await auth.getSession();
		expect(data.session?.refresh_token).toBe(session.refresh_token);
	});
});
