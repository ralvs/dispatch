import "server-only";
import { cachedValue, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { todayInTz } from "@/lib/dates";
import { getAppTimezone, getReminderSettings } from "@/lib/services/settings";
import type { Clock } from "@/lib/store/types";
import { createAdminClient } from "@/lib/supabase/admin";

/** App timezone rarely changes — cache hard, invalidate on settings.timezone. */
export async function getCachedAppTimezone(): Promise<string> {
	"use cache";
	return cachedValue(readers.getCachedAppTimezone, () => getAppTimezone(createAdminClient()));
}

/**
 * The request's clock: the app timezone and today in it. Deliberately not
 * `"use cache"`: the day is computed per request, so a cached entry that
 * survives midnight cannot carry yesterday.
 */
export async function readClock(): Promise<Clock> {
	const tz = await getCachedAppTimezone();
	return { tz, todayIso: todayInTz(tz) };
}

/** Reminder offset and anchor time, for /settings. */
export async function getCachedReminderSettings() {
	"use cache";
	return cachedValue(readers.getCachedReminderSettings, () =>
		getReminderSettings(createAdminClient()),
	);
}

export const readers = {
	getCachedAppTimezone: { tags: [CacheTag.settings], tables: ["app_settings"] },
	getCachedReminderSettings: { tags: [CacheTag.settings], tables: ["app_settings"] },
} satisfies Readers;
