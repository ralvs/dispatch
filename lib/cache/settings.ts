import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
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

export const readers: CachedReader[] = [
	{
		reader: "getCachedAppTimezone",
		reads: [{ tag: CacheTag.settings, writes: ["settings.timezone"] }],
	},
	{
		reader: "getCachedReminderSettings",
		reads: [{ tag: CacheTag.settings, writes: ["settings.reminders"] }],
	},
];
