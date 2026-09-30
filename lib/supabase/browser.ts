import { GoTrueClient } from "@supabase/auth-js";
// Not re-exported from the package root, but it is the exact cookie adapter
// createBrowserClient uses. Importing it keeps the cookie format identical to
// what the proxy and requireOwner() read (docs/adr/0067).
import { createStorageFromOptions } from "@supabase/ssr/dist/module/cookies";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

let cached: GoTrueClient | undefined;

/**
 * Cookie-backed browser auth client — auth state written here (sign-in/out)
 * is visible to the proxy and requireOwner().
 *
 * This is the auth half of `@supabase/ssr`'s createBrowserClient, without
 * the PostgREST, Storage, Realtime and Functions clients: the browser only
 * ever calls `auth.*` (docs/adr/0067). Same options, same storage key, same
 * cookie adapter, same browser-wide singleton — so the refresh ticker,
 * visibility listener and single-flight refresh behave exactly as before
 * (docs/adr/0025, 0032).
 *
 * `@supabase/auth-js` and `@supabase/supabase-js` are both pinned exact, to
 * the same version. Bump them together.
 *
 * Env vars are read as literal `process.env.NEXT_PUBLIC_*` expressions:
 * Next.js only inlines them into client bundles when accessed that way.
 */
export function browserAuth(): GoTrueClient {
	if (cached) return cached;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_* env vars");

	const { storage } = createStorageFromOptions(
		{ cookieOptions: AUTH_COOKIE_OPTIONS, cookieEncoding: "base64url" },
		false,
	);
	const base = new URL(url);
	const client = new GoTrueClient({
		url: new URL("auth/v1", base).href,
		headers: { Authorization: `Bearer ${key}`, apikey: key },
		// supabase-js's default key; the proxy and server clients derive the same one.
		storageKey: `sb-${base.hostname.split(".")[0]}-auth-token`,
		storage,
		flowType: "pkce",
		autoRefreshToken: true,
		detectSessionInUrl: true,
		persistSession: true,
	});
	// Like createBrowserClient: a singleton only in the browser, never shared
	// across server requests.
	if (typeof window !== "undefined") cached = client;
	return client;
}
