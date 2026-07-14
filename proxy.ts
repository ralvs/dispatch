import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

/**
 * UX + session upkeep only — never the security boundary (docs/adr/0003).
 * The one job that must live here: refreshing expired tokens, because this is
 * the single writer of rotated refresh-token cookies. Authorization stays in
 * requireOwner()/requireOwnerPage() inside handlers and layouts.
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
			cookies: {
				getAll() {
					return request.cookies.getAll();
				},
				setAll(cookiesToSet) {
					for (const { name, value } of cookiesToSet) {
						request.cookies.set(name, value);
					}
					response = NextResponse.next({ request });
					for (const { name, value, options } of cookiesToSet) {
						response.cookies.set(name, value, options);
					}
				},
			},
		},
	);

	// Nothing may run between client creation and getUser(): this call
	// refreshes the token and triggers setAll above.
	const {
		data: { user },
	} = await supabase.auth.getUser();

	const { pathname } = request.nextUrl;
	const isApi = pathname.startsWith("/api");
	// Fail closed if the env var is unset.
	const ownerId = process.env.OWNER_USER_ID;
	const isOwner = !!ownerId && user?.id === ownerId;

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
		"/((?!_next/static|_next/image|favicon.ico|sign-in|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
	],
};
