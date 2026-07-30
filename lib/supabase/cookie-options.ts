import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Shared auth-cookie options for browser, proxy, and RLS clients.
 *
 * Defaults from @supabase/ssr omit `secure`. On the installed iOS PWA that
 * means session cookies are written without the Secure flag on an HTTPS host.
 * Align every writer so chunks never diverge across scopes, and mark Secure
 * in production so Safari treats them as durable first-party HTTPS cookies.
 *
 * Keep maxAge / sameSite / path identical everywhere — a refresh that rewrites
 * one chunk with different attributes can leave the browser holding a mixed
 * generation that @supabase/ssr then treats as absent (decode → null).
 */
export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
	path: "/",
	sameSite: "lax",
	httpOnly: false,
	// 400 days — @supabase/ssr's own default (browser max-age cap).
	maxAge: 400 * 24 * 60 * 60,
	// NODE_ENV is inlined for the browser bundle; server/proxy use the same.
	secure: process.env.NODE_ENV === "production",
};
