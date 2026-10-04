import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { getAppTimezone, getReminderSettings } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/** App timezone rarely changes — cache hard, invalidate on settings.timezone. */
export async function getCachedAppTimezone(): Promise<string> {
	"use cache";
	cacheTag(CacheTag.settings);
	cacheLife("tagged");
	return getAppTimezone(createAdminClient());
}

/** Reminder offset and anchor time, for /settings. */
export async function getCachedReminderSettings() {
	"use cache";
	cacheTag(CacheTag.settings);
	cacheLife("tagged");
	return getReminderSettings(createAdminClient());
}

export const readers = {
	getCachedAppTimezone: { tags: [CacheTag.settings], tables: ["app_settings"] },
	getCachedReminderSettings: { tags: [CacheTag.settings], tables: ["app_settings"] },
} satisfies Readers;
