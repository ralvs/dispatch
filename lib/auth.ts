import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * RLS-scoped client bound to the request's session cookies (docs/adr/0003).
 * Private to this module so an RLS client can never be constructed without
 * going through the owner check below.
 *
 * The proxy owns token refresh; setAll here is a deliberate no-op so a second
 * writer never races refresh-token rotation.
 */
async function createRlsClient(): Promise<SupabaseClient> {
	const cookieStore = await cookies();
	const e = env();
	if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
		throw new Error("Supabase env vars are not configured");
	}

	return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll() {
				return cookieStore.getAll();
			},
			setAll() {},
		},
	});
}

async function currentUserAndClient(): Promise<{ user: User | null; sb: SupabaseClient }> {
	const sb = await createRlsClient();
	const {
		data: { user },
	} = await sb.auth.getUser();
	return { user, sb };
}

/** Exported for testing the fail-closed owner check in isolation. */
export function isOwner(user: User | null): user is User {
	const ownerId = env().OWNER_USER_ID;
	// Fail closed when OWNER_USER_ID is unset.
	return Boolean(ownerId && user && user.id === ownerId);
}

/**
 * The security boundary (docs/adr/0003) for route handlers: first line of
 * every session-authed handler, before parsing the body. Returns the same
 * RLS client used to authenticate, so callers never construct their own.
 *
 *   const auth = await requireOwner();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user, sb } = auth;
 */
export async function requireOwner(): Promise<{ user: User; sb: SupabaseClient } | NextResponse> {
	const { user, sb } = await currentUserAndClient();
	if (!isOwner(user)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return { user, sb };
}

/**
 * The same boundary for pages, layouts, and server actions — redirects to
 * /sign-in instead of returning JSON.
 *
 *   const { user, sb } = await requireOwnerPage();
 */
export async function requireOwnerPage(): Promise<{ user: User; sb: SupabaseClient }> {
	const { user, sb } = await currentUserAndClient();
	if (!isOwner(user)) redirect("/sign-in");
	return { user, sb };
}
