import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { DEFAULT_TIMEZONE } from "@/lib/dates";

/**
 * App timezone from the app_settings singleton. React-cached so one request
 * reads it at most once regardless of how many components ask.
 */
export const getAppTimezone = cache(async (sb: SupabaseClient): Promise<string> => {
	const { data } = await sb.from("app_settings").select("timezone").eq("id", true).maybeSingle();
	return data?.timezone ?? DEFAULT_TIMEZONE;
});

export async function updateAppTimezone(sb: SupabaseClient, timezone: string): Promise<void> {
	const { error } = await sb.from("app_settings").update({ timezone }).eq("id", true);
	if (error) throw error;
}
