import "server-only";
import { cachedRead, cachedValue, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listDomains } from "@/lib/services/domains";
import { listDomainTouchesOn } from "@/lib/services/observations";
import { listQuietProjectIds } from "@/lib/services/quiet";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for domains (docs/adr/0035). Admin client after
 * requireOwnerPage(), as in lib/cache/today.ts. Every page with a domain picker
 * reads through getCachedDomains.
 */
export async function getCachedDomains(includeArchived: boolean) {
	"use cache";
	return cachedValue(readers.getCachedDomains, () =>
		listDomains(createAdminClient(), { includeArchived }),
	);
}

/**
 * Everything /domains shows: every domain, archived included, and the last
 * touch and open-task count per active domain. The touch is the latest of a
 * done task, a project update and a note update, so all four tags. `todayIso`
 * and `tz` are the cache key — the day is computed per request, never in here.
 * The quiet projects go to the entity store with it, so a tick moves a
 * domain's open count by the rule that counted it (lib/counts.ts).
 */
export async function getCachedDomainBoard(todayIso: string, tz: string) {
	"use cache";
	return cachedRead(readers.getCachedDomainBoard, async () => {
		const sb = createAdminClient();
		const [domains, touches, quiet] = await Promise.all([
			listDomains(sb, { includeArchived: true }),
			listDomainTouchesOn(sb, todayIso, tz),
			listQuietProjectIds(sb),
		]);
		return { domains, touches, quietProjectIds: [...quiet] };
	});
}

export const readers = {
	getCachedDomains: { tags: [CacheTag.domains], tables: ["stewardship_domains"] },
	getCachedDomainBoard: {
		tags: [CacheTag.domains, CacheTag.tasks, CacheTag.projects, CacheTag.notes],
		tables: ["stewardship_domains", "tasks", "projects", "notes"],
	},
} satisfies Readers;
