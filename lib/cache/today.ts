import "server-only";
import { cacheLife, cacheTag } from "next/cache";
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
	cacheLife({ stale: 60, revalidate: 120, expire: 600 });
	return loadTodayDigest(createAdminClient(), todayIso);
}
