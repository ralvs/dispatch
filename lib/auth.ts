import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";
import { env } from "@/lib/env";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * What a passed guard hands back: the verified claims of the request's access
 * token, plus the RLS client that read them. `claims.sub` is the user id and
 * `claims.email` is the only other claim this app reads — JwtPayload carries an
 * `any` index signature, so anything else you reach for typechecks and is
 * undefined at runtime (docs/adr/0031).
 */
export type OwnerAuth = { claims: JwtPayload; sb: SupabaseClient };

/**
 * RLS-scoped client bound to the request's session cookies (docs/adr/0003).
 * Private to this module so an RLS client can never be constructed without
 * going through the owner check below.
 *
 * The proxy is still the primary refresher, but setAll must not be a no-op
 * (docs/adr/0025). auth-js rotates the refresh token from inside getClaims()
 * (no-arg form) whenever the stored access token is within its expiry margin —
 * the network call to /token happens, and the old refresh token is revoked,
 * whether or not we keep the result. Dropping the rotated token on the floor
 * leaves the browser holding a credential Supabase has already revoked, and
 * the next request signs the user out. So: persist wherever the platform lets us.
 */
async function createRlsClient(): Promise<SupabaseClient> {
	const cookieStore = await cookies();
	const e = env();
	if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
		throw new Error("Supabase env vars are not configured");
	}

	return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookieOptions: AUTH_COOKIE_OPTIONS,
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					for (const { name, value, options } of cookiesToSet) {
						cookieStore.set(name, value, options);
					}
				} catch {
					// Server Component render — the cookie store is read-only here and
					// set() throws. The proxy refreshed on the way in and forwarded the
					// fresh cookies on `request`, so a rotation this deep into a render
					// is the rare case, not the norm.
				}
			},
		},
	});
}

/**
 * One identity read per request (docs/adr/0031). Local JWT verification via
 * getClaims() — no hop to Supabase Auth's /user endpoint when the project uses
 * asymmetric signing (ES256). No jwt argument, deliberately: that form loads
 * the stored session first so a token inside its expiry margin still refreshes
 * and triggers setAll (ADR-0025).
 */
const currentClaimsAndClient = cache(
	async (): Promise<{ claims: JwtPayload | null; sb: SupabaseClient }> => {
		const sb = await createRlsClient();
		// `data` is null both for "no session" and for "verification failed";
		// both are denials, so there is nothing to branch on.
		const { data } = await sb.auth.getClaims();
		return { claims: data?.claims ?? null, sb };
	},
);

/** Exported for testing the fail-closed owner check in isolation. */
export function isOwner(claims: JwtPayload | null): claims is JwtPayload {
	const ownerId = env().OWNER_USER_ID;
	// Fail closed when OWNER_USER_ID is unset, and when `sub` is absent.
	return Boolean(ownerId && claims && claims.sub === ownerId);
}

/**
 * The security boundary (docs/adr/0003) for route handlers: first line of
 * every session-authed handler, before parsing the body. Returns the same
 * RLS client used to authenticate, so callers never construct their own.
 *
 * Identity is request-scoped via React cache() on the shared helper so layout
 * + page + nested loaders share one verification; each denial builds its own
 * NextResponse (docs/adr/0031).
 *
 *   const auth = await requireOwner();
 *   if (auth instanceof NextResponse) return auth;
 *   const { claims, sb } = auth;
 */
export async function requireOwner(): Promise<OwnerAuth | NextResponse> {
	const { claims, sb } = await currentClaimsAndClient();
	if (!isOwner(claims)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return { claims, sb };
}

/**
 * The same boundary for pages, layouts, and server actions — redirects to
 * /sign-in instead of returning JSON.
 *
 *   const { claims, sb } = await requireOwnerPage();
 */
export async function requireOwnerPage(): Promise<OwnerAuth> {
	const { claims, sb } = await currentClaimsAndClient();
	if (!isOwner(claims)) redirect("/sign-in");
	return { claims, sb };
}

/**
 * Wraps a route handler with the requireOwner() check so handlers never see
 * the `{claims,sb} | NextResponse` union directly:
 *
 *   export const POST = ownerRoute((request, { sb }) => { ... });
 */
export function ownerRoute<Args extends unknown[]>(
	handler: (request: Request, auth: OwnerAuth, ...args: Args) => Promise<Response>,
): (request: Request, ...args: Args) => Promise<Response> {
	return async (request, ...args) => {
		const auth = await requireOwner();
		if (auth instanceof NextResponse) return auth;
		return handler(request, auth, ...args);
	};
}
