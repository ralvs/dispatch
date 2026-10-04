import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { listCompletionsForRoutines, listRoutines } from "@/lib/services/routines";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /routines (docs/adr/0035): the routines and their
 * completions since `sinceIso`. The window start is the cache key, computed per
 * request from the app day — never here.
 *
 * `readAt` is the entity store's version (lib/store/types.ts), stamped inside
 * the cache so a stale entry keeps its old stamp.
 */
export async function getCachedRoutines(sinceIso: string) {
	"use cache";
	cacheTag(CacheTag.routines);
	cacheLife("tagged");

	const readAt = nowUtc();
	const sb = createAdminClient();
	const routines = await listRoutines(sb);
	const completionsByRoutine = await listCompletionsForRoutines(
		sb,
		routines.map((r) => r.id),
		sinceIso,
	);
	return { readAt, routines, completionsByRoutine };
}

export const readers = {
	getCachedRoutines: { tags: [CacheTag.routines], tables: ["routines", "routine_completions"] },
} satisfies Readers;
