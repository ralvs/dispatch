import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { quietProjectIdsOf } from "@/lib/quiet";
import { unwrap } from "@/lib/services/errors";

/**
 * The ids of the quiet projects (lib/quiet.ts), read from the database.
 *
 * Deliberately a whole-table read of two columns, judged by `quietProjectIdsOf`
 * rather than a `status` filter here, so the rule has one encoding. The project
 * list is tiny, and the alternative — a PostgREST embedded `!inner` filter on
 * the join — would silently drop every task with no project at all, which is
 * exactly the set that must never go quiet.
 */
export async function listQuietProjectIds(sb: SupabaseClient): Promise<Set<string>> {
	const data = unwrap(await sb.from("projects").select("id, status")) as Array<{
		id: string;
		status: string;
	}> | null;
	return new Set(quietProjectIdsOf(data ?? []));
}
