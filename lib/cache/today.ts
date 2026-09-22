import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { loadTodayDigest } from "@/lib/services/today";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for Today (docs/adr/0033).
 *
 * Uses the service-role client because `"use cache"` cannot close over an
 * RLS client that depends on cookies(). Call only after requireOwnerPage() —
 * single-user app; admin reads the same rows the owner would under RLS.
 */

/** Cold digest: quotes, projects, routines, domains, alert counts. */
export async function getCachedTodayDigest(todayIso: string) {
	"use cache";
	cacheTag(CacheTag.todayDigest);
	cacheLife("tagged");
	return loadTodayDigest(createAdminClient(), todayIso);
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedTodayDigest",
		reads: [
			{
				tag: CacheTag.todayDigest,
				// Routines and completions, needs-review count, quotes and skips,
				// domains, unread notifications, active projects, unread links, task
				// counts per project.
				writes: [
					"task.write",
					"task.assign",
					"capture.settled",
					"routine.write",
					"links.write",
					"notification.write",
					"settings.domain",
					"settings.timezone",
					"today.only",
					"notes.write",
					"quotes.write",
					"projects.write",
					"projects.detail",
				],
				external: [
					"capture",
					"captureLink",
					"sweep",
					"cronObservations",
					"cronReminders",
					"calendarBridgeFailure",
				],
			},
		],
	},
];
