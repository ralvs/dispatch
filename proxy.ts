import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// Mirror lib/supabase/cookie-options.ts — proxy cannot import that module
// (edge bundle; keep this file free of server-only / zod). Keep the two in
// lockstep: path, sameSite, maxAge, secure.
const AUTH_COOKIE_OPTIONS = {
	path: "/",
	sameSite: "lax" as const,
	httpOnly: false,
	maxAge: 400 * 24 * 60 * 60,
	secure: process.env.NODE_ENV === "production",
};

/**
 * UX + session upkeep only — never the security boundary (docs/adr/0003).
 * Refreshes expired tokens on the way in so the downstream render sees a live
 * session. Authorization stays in requireOwner()/requireOwnerPage() inside
 * handlers and layouts.
 *
 * This is NOT a single writer, and code here must not assume it is: middleware
 * runs once per request, and a page load fans out into many concurrent ones.
 * The browser-side SessionKeeper is what keeps the token fresh ahead of that
 * fan-out so this path rarely has to rotate anything (docs/adr/0025, 0032).
 */
export async function proxy(request: NextRequest) {
	// setAll rebuilds this response so refreshed cookies reach BOTH the
	// downstream handler (via request) and the browser (via response).
	let response = NextResponse.next({ request });

	const supabase = createServerClient(
		// biome-ignore lint/style/noNonNullAssertion: edge runtime; lib/env would drag in zod
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		// biome-ignore lint/style/noNonNullAssertion: same
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{
			cookieOptions: AUTH_COOKIE_OPTIONS,
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet, headers) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					response = NextResponse.next({ request });
					for (const { name, value, options } of cookiesToSet) {
						response.cookies.set(name, value, options);
					}
					// @supabase/ssr requires these on any response that sets auth
					// cookies so a CDN never caches one user's Set-Cookie for another.
					if (headers) {
						for (const [key, value] of Object.entries(headers)) {
							response.headers.set(key, value);
						}
					}
				},
			},
		},
	);

	// Nothing may run between client creation and getClaims(): called with no
	// jwt argument it loads the stored session first, so a token inside its
	// expiry margin still refreshes here and triggers setAll above — the same
	// rotation getUser() did. Handing it a token explicitly would skip that
	// (docs/adr/0031).
	const { data } = await supabase.auth.getClaims();

	const { pathname } = request.nextUrl;
	const isApi = pathname.startsWith("/api");
	// Fail closed if the env var is unset.
	const ownerId = process.env.OWNER_USER_ID;
	const isOwner = !!ownerId && data?.claims.sub === ownerId;

	// Redirect only page navigations; API requests fall through so callers get
	// JSON 401 from requireOwner() (or secret-auth) instead of an HTML redirect.
	if (!isApi && !isOwner) {
		const url = request.nextUrl.clone();
		url.pathname = "/sign-in";
		const redirect = NextResponse.redirect(url);
		for (const c of response.cookies.getAll()) redirect.cookies.set(c);
		return redirect;
	}

	return response;
}

export const config = {
	matcher: [
		// Everything except /sign-in, Next internals, and static assets. /api is
		// deliberately INCLUDED so token refresh happens here, serially.
		// /sign-in stays out so the recovery client on that page can refresh
		// without a proxy redirect loop (docs/adr/0032).
		//
		// js/json/webmanifest/woff2 are excluded for cost, not for taste: /sw.js
		// and /manifest.webmanifest are fetched on every service-worker update
		// check and every PWA launch, and running the full auth pass on them
		// also meant a cold PWA got a 307 to /sign-in *for its manifest*. No
		// route in this app ends in one of these, and RSC payloads are a query
		// param on a normal path, so nothing that needs auth is let through.
		"/((?!_next/static|_next/image|favicon.ico|sign-in|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|json|webmanifest|woff2?)$).*)",
	],
};
