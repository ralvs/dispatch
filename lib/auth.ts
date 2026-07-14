import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

async function currentUser(): Promise<User | null> {
	const cookieStore = await cookies();
	const e = env();
	if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;

	const supabase = createServerClient(
		e.NEXT_PUBLIC_SUPABASE_URL,
		e.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				// The proxy owns token refresh; a second writer here would race
				// refresh-token rotation on concurrent requests.
				setAll() {},
			},
		},
	);

	const {
		data: { user },
	} = await supabase.auth.getUser();
	return user;
}

function isOwner(user: User | null): user is User {
	const ownerId = env().OWNER_USER_ID;
	// Fail closed when OWNER_USER_ID is unset.
	return Boolean(ownerId && user && user.id === ownerId);
}

/**
 * The security boundary (docs/adr/0003) for route handlers: first line of
 * every session-authed handler, before parsing the body.
 *
 *   const auth = await requireOwner();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function requireOwner(): Promise<User | NextResponse> {
	const user = await currentUser();
	if (!isOwner(user)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return user;
}

/**
 * The same boundary for pages, layouts, and server actions — redirects to
 * /sign-in instead of returning JSON.
 */
export async function requireOwnerPage(): Promise<User> {
	const user = await currentUser();
	if (!isOwner(user)) redirect("/sign-in");
	return user;
}
