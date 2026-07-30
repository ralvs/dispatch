import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * Cookie-backed browser client — auth state written here (sign-in/out) is
 * visible to the proxy and requireOwner().
 *
 * Env vars are read as literal `process.env.NEXT_PUBLIC_*` expressions:
 * Next.js only inlines them into client bundles when accessed that way.
 */
export function createBrowserSupabase() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_* env vars");
	return createBrowserClient(url, key, {
		cookieOptions: AUTH_COOKIE_OPTIONS,
	});
}
