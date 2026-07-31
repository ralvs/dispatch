import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import { loadBriefingChrome } from "@/lib/services/briefing";
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
