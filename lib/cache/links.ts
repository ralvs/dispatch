import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import { listLinks } from "@/lib/services/links";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /links (docs/adr/0035). Admin client after
 * requireOwnerPage(), as in lib/cache/briefing.ts.
 *
 * The reading pile is filled mostly from outside the app — a bare URL posted
 * to /api/capture — so this entry depends on that route busting `links`.
 * Before ADR-0035 it did not, which is why this was not cacheable.
 */
export async function getCachedLinks() {
	"use cache";
	cacheTag(CacheTag.links);
	cacheLife({ stale: 60, revalidate: 300, expire: 900 });

	return listLinks(createAdminClient(), { limit: 200 });
}
