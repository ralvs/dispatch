import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import {
	type BriefingView,
	type DaySchedule,
	getBriefing,
	getDaySchedule,
	loadBriefingChrome,
	loadDayScheduleInputs,
} from "@/lib/services/briefing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for Today (docs/adr/0033).
 *
 * Uses the service-role client because `"use cache"` cannot close over an
 * RLS client that depends on cookies(). Call only after requireOwnerPage() —
 * single-user app; admin reads the same rows the owner would under RLS.
 */

/** Cold chrome: quotes, projects, routines, domain cadence, alert counts. */
export async function getCachedBriefingChrome(todayIso: string) {
	"use cache";
	cacheTag(CacheTag.todayChrome);
	cacheLife({ stale: 60, revalidate: 120, expire: 600 });
	return loadBriefingChrome(createAdminClient(), todayIso);
}

/**
 * Full briefing with chrome cached and schedule inputs always re-fetched by
 * the caller (or via getCachedDaySchedule for off-today navigation).
 * Prefer assembleBriefingFromParts from the page when schedule must stay hot.
 */
export async function getCachedBriefing(
	tz: string,
	todayIso: string,
	nowMs: number = Date.now(),
): Promise<BriefingView> {
	"use cache";
	// Tag both segments so either mutation path invalidates the whole view.
	cacheTag(CacheTag.todayChrome, CacheTag.daySchedule);
	cacheLife({ stale: 30, revalidate: 60, expire: 300 });
	return getBriefing(createAdminClient(), tz, todayIso, nowMs);
}

/** Day bands for an arbitrary date (Today day-nav Server Action + SSR seed). */
export async function getCachedDaySchedule(tz: string, dateIso: string): Promise<DaySchedule> {
	"use cache";
	cacheTag(CacheTag.daySchedule);
	cacheLife({ stale: 20, revalidate: 40, expire: 180 });
	return getDaySchedule(createAdminClient(), tz, dateIso);
}

/** Open tasks + events only — tag day-schedule, short life. */
export async function getCachedDayScheduleInputs(tz: string, dateIso: string) {
	"use cache";
	cacheTag(CacheTag.daySchedule);
	cacheLife({ stale: 20, revalidate: 40, expire: 180 });
	return loadDayScheduleInputs(createAdminClient(), tz, dateIso);
}
