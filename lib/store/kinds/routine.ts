// The routine kind (#29). A row is a routine with its completion log
// (RoutineWithHistory), so a tick is a change to one row: its version covers
// the routine and its log together, and Today's card and /routines read the
// same row. A completion's natural key (routine_id, completed_date) is a date
// in that log, and a tick names the state it wants, so a replay is idempotent.
//
// ADR-0054: a tick names its day, here and on the server.

import type { RoutineRow, RoutineWithHistory } from "@/lib/schemas/routine";
import type { KindAdapter, RowEntry, ViewAdapter } from "@/lib/store/types";

export type RoutineIntent =
	| { type: "toggle"; id: string; date: string; done: boolean }
	| { type: "create"; routine: RoutineWithHistory }
	| { type: "edit"; id: string; patch: Partial<Pick<RoutineRow, "name" | "time_of_day">> }
	| { type: "delete"; id: string };

function setDone(dates: string[], date: string, done: boolean): string[] {
	const has = dates.includes(date);
	if (done === has) return dates;
	return done ? [...dates, date].sort() : dates.filter((d) => d !== date);
}

/** The row after the intent. Undefined: the intent removed it. */
export function applyRoutineIntent(
	row: RoutineWithHistory,
	intent: Exclude<RoutineIntent, { type: "create" }>,
): RoutineWithHistory | undefined {
	switch (intent.type) {
		case "toggle": {
			const completions = setDone(row.completions, intent.date, intent.done);
			return completions === row.completions ? row : { ...row, completions };
		}
		case "edit":
			return { ...row, ...intent.patch };
		case "delete":
			return undefined;
	}
}

export const routineKind: KindAdapter<"routine"> = {
	idOf: (row) => row.id,
	targetId: (intent) => (intent.type === "create" ? intent.routine.id : intent.id),
	provisionalIds: (intent) => (intent.type === "create" ? [intent.routine.id] : []),
};

/** An archived routine is listed nowhere (listRoutines). */
const listed = (row: RoutineWithHistory) => row.archived_at == null;

export const routineListView: ViewAdapter<"routineList"> = {
	kind: "routine",
	fromSeed: (data) => ({ base: data, params: undefined }),
	rowsOf: (view) => view,
	reduce: (view, intent) => {
		if (intent.type === "create") {
			return view.some((r) => r.id === intent.routine.id) ? view : [...view, intent.routine];
		}
		let changed = false;
		const out: RoutineWithHistory[] = [];
		for (const row of view) {
			if (row.id !== intent.id) {
				out.push(row);
				continue;
			}
			const next = applyRoutineIntent(row, intent);
			if (next !== row) changed = true;
			if (next) out.push(next);
		}
		return changed ? out : view;
	},
	upsert: (view, rows) => {
		let out = view;
		for (const row of rows) {
			const present = out.some((r) => r.id === row.id);
			if (!listed(row)) {
				if (present) out = out.filter((r) => r.id !== row.id);
			} else if (present) {
				out = out.map((r) => (r.id === row.id ? row : r));
			} else {
				// A create the server confirmed: a new routine sorts last.
				out = [...out, row];
			}
		}
		return out;
	},
	remove: (view, ids) =>
		view.some((r) => ids.has(r.id)) ? view.filter((r) => !ids.has(r.id)) : view,
	patch: (view, rowOf) => {
		let changed = false;
		const out: RoutineWithHistory[] = [];
		for (const row of view) {
			const entry: RowEntry<RoutineWithHistory> | undefined = rowOf(row.id);
			if (entry === undefined) {
				out.push(row);
			} else if ("deleted" in entry || !listed(entry.row)) {
				changed = true;
			} else {
				if (entry.row !== row) changed = true;
				out.push(entry.row);
			}
		}
		return changed ? out : view;
	},
};
