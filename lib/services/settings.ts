import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { DEFAULT_TIMEZONE, todayInTz } from "@/lib/dates";
import { unwrap } from "@/lib/services/errors";

/**
 * App timezone from the app_settings singleton. React-cached so one request
 * reads it at most once regardless of how many components ask.
 */
export const getAppTimezone = cache(async (sb: SupabaseClient): Promise<string> => {
	const { data } = await sb.from("app_settings").select("timezone").eq("id", true).maybeSingle();
	return data?.timezone ?? DEFAULT_TIMEZONE;
});

/**
 * Today's date (ISO, `YYYY-MM-DD`) in the app timezone. For call sites that
 * only need `tz` to derive today's date — replaces the
 * `getAppTimezone` + `todayInTz(tz)` pair with one call.
 */
export async function todayForRequest(sb: SupabaseClient): Promise<string> {
	return todayInTz(await getAppTimezone(sb));
}

export async function updateAppTimezone(sb: SupabaseClient, timezone: string): Promise<void> {
	unwrap(await sb.from("app_settings").update({ timezone }).eq("id", true));
}
