import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftDay, todayInTz } from "@/lib/dates";
import { ROUTINE_HISTORY_DAYS } from "@/lib/routine-stats";
import { getDomain } from "@/lib/services/domains";
import { getNote } from "@/lib/services/notes";
import { listDomainTouchesOn, toDomainItem } from "@/lib/services/observations";
import { getPerson } from "@/lib/services/people";
import { getProject } from "@/lib/services/projects";
import { getRoutineWithHistory } from "@/lib/services/routines";
import { getAppTimezone, todayForRequest } from "@/lib/services/settings";
import { getTask } from "@/lib/services/tasks";
import { stampWrite } from "@/lib/store/server";
import type { EntityMap, StoreWrite } from "@/lib/store/types";

// The one read-back (docs/adr/0077): the row a write left, as the store holds
// it, for the client to confirm its intent from. Takes `sb` first (iron rule
// #3). Never export this from a "use server" file: it would become an
// endpoint with no owner check (iron rule #2).

export type ReadBackKind = "task" | "routine" | "note" | "project" | "person" | "domain";

type ReadOpts = { todayIso?: string };

const readers: {
	[K in ReadBackKind]: (
		sb: SupabaseClient,
		id: string,
		opts: ReadOpts,
	) => Promise<EntityMap[K] | null>;
} = {
	/** Read back with its joins. */
	task: (sb, id) => getTask(sb, id),
	/** With the same history window the pages read. */
	routine: async (sb, id, { todayIso }) => {
		const today = todayIso ?? (await todayForRequest(sb));
		return getRoutineWithHistory(sb, id, shiftDay(today, -ROUTINE_HISTORY_DAYS));
	},
	note: (sb, id) => getNote(sb, id),
	project: (sb, id) => getProject(sb, id),
	person: (sb, id) => getPerson(sb, id),
	/** As /domains shows it: with its cadence rule and last touch. */
	domain: async (sb, id) => {
		const [row, tz] = await Promise.all([getDomain(sb, id), getAppTimezone(sb)]);
		if (!row) return null;
		const touches = row.active ? await listDomainTouchesOn(sb, todayInTz(tz), tz) : [];
		return toDomainItem(row, touches);
	},
};

/**
 * The row as it stands after the write, with `also` (rows the same write
 * made, such as a recurring task's successor) after it. A row that is gone
 * comes back as a deleted id, so the store drops it rather than keeping a row
 * the server no longer has.
 */
export async function written<K extends ReadBackKind>(
	sb: SupabaseClient,
	kind: K,
	id: string,
	opts: { todayIso?: string; also?: EntityMap[K][] } = {},
): Promise<StoreWrite<EntityMap[K]>> {
	const also = opts.also ?? [];
	const row = (await readers[kind](sb, id, opts)) as EntityMap[K] | null;
	return row ? stampWrite([row, ...also]) : stampWrite(also, [id]);
}
