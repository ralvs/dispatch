import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { listNotifications } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /notifications (docs/adr/0035). Almost every row is
 * written from outside the app (iron rule #6), so this entry is only as fresh
 * as the external writers below — the test in
 * lib/mutation-feedback/invalidate.test.ts holds every route that records a
 * notification to busting this tag.
 *
 * `readAt` is the entity store's version (lib/store/types.ts), stamped inside
 * the cache so a stale entry keeps its old stamp and a confirmed write
 * replays over it.
 */
export async function getCachedNotifications() {
	"use cache";
	cacheTag(CacheTag.notifications);
	cacheLife("tagged");

	const readAt = nowUtc();
	const notifications = await listNotifications(createAdminClient(), { limit: 100 });
	return { readAt, notifications };
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedNotifications",
		reads: [
			{
				tag: CacheTag.notifications,
				writes: ["notification.write"],
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
