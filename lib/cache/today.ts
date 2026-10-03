import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { loadTodayDigest } from "@/lib/services/today";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for Today (docs/adr/0033).
 *
 * Uses the service-role client because `"use cache"` cannot close over an
 * RLS client that depends on cookies(). Call only after requireOwnerPage() —
 * single-user app; admin reads the same rows the owner would under RLS.
 */

/**
 * Cold digest: quotes, projects, routines, domains, alert counts.
 *
 * `readAt` is the entity store's version for what Today seeds from the digest
 * (lib/store/types.ts), stamped inside the cache: a stale entry served after a
 * write keeps its old stamp, so the confirmed write replays over it.
 */
export async function getCachedTodayDigest(todayIso: string) {
	"use cache";
	cacheTag(CacheTag.todayDigest);
	cacheLife("tagged");
	const readAt = nowUtc();
	const digest = await loadTodayDigest(createAdminClient(), todayIso);
	return { ...digest, readAt };
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
					"capture.event",
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
