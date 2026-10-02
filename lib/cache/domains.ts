import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { listDomainTouchesOn } from "@/lib/services/observations";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for domains (docs/adr/0035). Admin client after
 * requireOwnerPage(), as in lib/cache/today.ts. Every page with a domain picker
 * reads through getCachedDomains.
 */
export async function getCachedDomains(includeArchived: boolean) {
	"use cache";
	cacheTag(CacheTag.domains);
	cacheLife("tagged");

	return listDomains(createAdminClient(), { includeArchived });
}

/**
 * Everything /domains shows: every domain, archived included, and the last
 * touch and open-task count per active domain. The touch is the latest of a
 * done task, a project update and a note update, so all four tags. `todayIso`
 * and `tz` are the cache key — the day is computed per request, never in here.
 *
 * `readAt` is the entity store's version (lib/store/types.ts), stamped inside
 * the cache so a stale entry keeps its old stamp.
 */
export async function getCachedDomainBoard(todayIso: string, tz: string) {
	"use cache";
	cacheTag(CacheTag.domains, CacheTag.tasks, CacheTag.projects, CacheTag.notes);
	cacheLife("tagged");

	const readAt = nowUtc();
	const sb = createAdminClient();
	const [domains, touches] = await Promise.all([
		listDomains(sb, { includeArchived: true }),
		listDomainTouchesOn(sb, todayIso, tz),
	]);
	return { readAt, domains, touches };
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedDomains",
		reads: [{ tag: CacheTag.domains, writes: ["settings.domain"] }],
	},
	{
		reader: "getCachedDomainBoard",
		reads: [
			{ tag: CacheTag.domains, writes: ["settings.domain"] },
			{
				tag: CacheTag.tasks,
				writes: ["task.write", "task.assign", "capture.settled", "capture.event"],
				external: ["capture", "sweep"],
			},
			{ tag: CacheTag.projects, writes: ["projects.write", "projects.detail"] },
			{
				tag: CacheTag.notes,
				writes: ["notes.write", "capture.settled", "capture.event"],
				external: ["capture", "sweep"],
			},
		],
	},
];
