import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

let cached: SupabaseClient | undefined;

/**
 * Service-role client — bypasses RLS. Reserved for the external surfaces
 * (cron, capture, widget) and CalDAV/push machinery. Never import
 * from page or action code; those use requireOwner()/requireOwnerPage()
 * (lib/auth.ts), which return the RLS-scoped client.
 */
export function createAdminClient(): SupabaseClient {
	if (!cached) {
		const e = env();
		if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SECRET_KEY) {
			throw new Error("Supabase admin env vars are not configured");
		}
		cached = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
	}
	return cached;
}
