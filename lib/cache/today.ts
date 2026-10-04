import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
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

/**
 * Cold digest: quotes, projects, routines, domains, alert counts.
 *
 * Stamped through cachedRead: `readAt` is the entity store's version for what
 * Today seeds from the digest (lib/store/types.ts).
 */
export async function getCachedTodayDigest(todayIso: string) {
	"use cache";
	return cachedRead(readers.getCachedTodayDigest, () =>
		loadTodayDigest(createAdminClient(), todayIso),
	);
}

export const readers = {
	getCachedTodayDigest: {
		tags: [CacheTag.todayDigest],
		// Routines and completions, needs-review count, quotes and skips,
		// domains, unread notifications, active projects, unread links, task
		// counts per project.
		tables: [
			"routines",
			"routine_completions",
			"notes",
			"quotes",
			"stewardship_domains",
			"notifications",
			"resurfacing_seen",
			"projects",
			"ingest_links",
			"tasks",
		],
	},
} satisfies Readers;
