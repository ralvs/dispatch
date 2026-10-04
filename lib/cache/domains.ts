import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Readers } from "@/lib/cache/reader";
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

export const readers = {
	getCachedDomains: { tags: [CacheTag.domains], tables: ["stewardship_domains"] },
	getCachedDomainBoard: {
		tags: [CacheTag.domains, CacheTag.tasks, CacheTag.projects, CacheTag.notes],
		tables: ["stewardship_domains", "tasks", "projects", "notes"],
	},
} satisfies Readers;
