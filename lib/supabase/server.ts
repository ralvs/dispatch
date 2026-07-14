import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * RLS-scoped client bound to the request's session cookies. Used by all
 * pages, server components, and server actions — queries run as the signed-in
 * user with RLS enforced.
 *
 * The proxy owns token refresh; setAll here is a deliberate no-op so a second
 * writer never races refresh-token rotation (see docs/adr/0003).
 */
export async function createRlsClient(): Promise<SupabaseClient> {
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
