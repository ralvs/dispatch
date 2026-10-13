import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database";
import { env } from "@/lib/env";
import type { SupabaseClient } from "@/lib/supabase/types";

let cached: SupabaseClient | undefined;

/**
 * Service-role client — bypasses RLS. Reserved for the external surfaces
 * (cron, capture, widget), CalDAV/push machinery, and the ledger's push
 * delivery (lib/services/notifications.ts). Never import
 * from page or action code; those use requireOwner()/requireOwnerPage()
 * (lib/auth.ts), which return the RLS-scoped client.
 */
export function createAdminClient(): SupabaseClient {
	if (!cached) {
		const e = env();
		if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SECRET_KEY) {
			throw new Error("Supabase admin env vars are not configured");
		}
		cached = createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
	}
	return cached;
}
