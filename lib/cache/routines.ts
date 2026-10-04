import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listCompletionsForRoutines, listRoutines } from "@/lib/services/routines";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /routines (docs/adr/0035): the routines and their
 * completions since `sinceIso`. The window start is the cache key, computed per
 * request from the app day — never here.
 */
export async function getCachedRoutines(sinceIso: string) {
	"use cache";
	return cachedRead(readers.getCachedRoutines, async () => {
		const sb = createAdminClient();
		const routines = await listRoutines(sb);
		const completionsByRoutine = await listCompletionsForRoutines(
			sb,
			routines.map((r) => r.id),
			sinceIso,
		);
		return { routines, completionsByRoutine };
	});
}

export const readers = {
	getCachedRoutines: { tags: [CacheTag.routines], tables: ["routines", "routine_completions"] },
} satisfies Readers;
