import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap } from "@/lib/services/errors";

/**
 * The projects whose tasks are quiet — every project that is not `active`
 * (paused, done or archived).
 *
 * One definition, shared by Today, /tasks and the neglect sweep, so the three
 * surfaces cannot drift on what "quiet" means. Deliberately a whole-table read
 * of one column: the project list is tiny, and the alternative — a PostgREST
 * embedded `!inner` filter on the join — would silently drop every task with
 * no project at all, which is exactly the set that must never go quiet.
 *
 * The predicate itself lives in lib/task-predicates.ts (`isQuiet`); this is
 * only the lookup it needs.
 */
export async function listQuietProjectIds(sb: SupabaseClient): Promise<Set<string>> {
	const data = unwrap(await sb.from("projects").select("id").neq("status", "active")) as Array<{
		id: string;
	}> | null;
	return new Set((data ?? []).map((row) => row.id));
}
