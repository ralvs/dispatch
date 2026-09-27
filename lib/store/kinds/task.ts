// The task kind: three view types built on the existing reducers, so the store
// and the pre-store optimistic layer cannot drift on what an intent means.

import { dateOfInstant } from "@/lib/dates";
import {
	collectDayEvents,
	collectDayTasks,
	type DaySchedulePayload,
	placeOnDay,
} from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/schemas/task";
import type { Clock, KindAdapter, RowEntry, TaskScope, ViewAdapter } from "@/lib/store/types";
import {
	applyDayTaskList,
	applyTaskLists,
	type TaskIntent,
} from "@/lib/task-interaction/apply-intent";

/** How many finished rows /tasks keeps (mirrors applyTaskLists). */
const DONE_CAP = 10;

export const taskKind: KindAdapter<"task"> = {
	idOf: (row) => row.id,
	provisionalIds: (intent) => (intent.type === "create" ? [intent.task.id] : []),
};

/** Replace rows by id from `rowOf`; drop tombstones. Same array when nothing changed. */
function patchRows(
	rows: TaskRow[],
	rowOf: (id: string) => RowEntry<TaskRow> | undefined,
): TaskRow[] {
	let changed = false;
	const out: TaskRow[] = [];
	for (const row of rows) {
		const entry = rowOf(row.id);
		if (entry === undefined) {
			out.push(row);
		} else if ("deleted" in entry) {
			changed = true;
		} else {
			if (entry.row !== row) changed = true;
			out.push(entry.row);
		}
	}
	return changed ? out : rows;
}

function without(rows: TaskRow[], ids: ReadonlySet<string>): TaskRow[] {
	return rows.some((r) => ids.has(r.id)) ? rows.filter((r) => !ids.has(r.id)) : rows;
}

function replaceById(rows: TaskRow[], row: TaskRow): TaskRow[] {
	return rows.map((r) => (r.id === row.id ? row : r));
}

export const taskListsView: ViewAdapter<"taskLists"> = {
	kind: "task",
	fromSeed: (data) => ({ base: data, params: undefined }),
	rowsOf: (view) => [...view.open, ...view.done],
	reduce: (view, intent, ctx) =>
		applyTaskLists(view, intent, { todayIso: ctx.todayIso, nowIso: ctx.nowIso }),
	upsert: (view, rows) => {
		let { open, done } = view;
		for (const row of rows) {
			if (open.some((r) => r.id === row.id)) open = replaceById(open, row);
			else if (done.some((r) => r.id === row.id)) done = replaceById(done, row);
			// Admit by status. A recurring completion's successor (ADR-0059) is a
			// server-made open row, and this is how it appears.
			else if (row.status === "open") open = [row, ...open];
			else done = [row, ...done].slice(0, DONE_CAP);
		}
		return open === view.open && done === view.done ? view : { open, done };
	},
	remove: (view, ids) => {
		const open = without(view.open, ids);
		const done = without(view.done, ids);
		return open === view.open && done === view.done ? view : { open, done };
	},
	patch: (view, rowOf) => {
		const open = patchRows(view.open, rowOf);
		const done = patchRows(view.done, rowOf);
		return open === view.open && done === view.done ? view : { open, done };
	},
};

export function inTaskScope(row: TaskRow, scope: TaskScope | undefined): boolean {
	if (!scope) return false;
	if ("projectId" in scope) return row.project_id === scope.projectId;
	return row.domain_id === null && row.status === scope.status;
}

export const taskListView: ViewAdapter<"taskList"> = {
	kind: "task",
	fromSeed: (data) => ({ base: data.rows, params: data.scope }),
	rowsOf: (view) => view,
	reduce: (view, intent, ctx, scope) => {
		// A create belongs only to the list whose scope it matches — without the
		// guard it would show in every cached project list.
		if (intent.type === "create" && !inTaskScope(intent.task, scope)) return view;
		return applyDayTaskList(view, intent, { todayIso: ctx.todayIso, nowIso: ctx.nowIso });
	},
	upsert: (view, rows, _clock, scope) => {
		let out = view;
		for (const row of rows) {
			if (out.some((r) => r.id === row.id)) out = replaceById(out, row);
			else if (inTaskScope(row, scope)) out = [row, ...out];
		}
		return out;
	},
	remove: (view, ids) => without(view, ids),
	patch: (view, rowOf) => patchRows(view, rowOf),
};

/** Re-place a day's task pool; events, now and note-id maps pass through. */
function replace(view: DaySchedulePayload, tasks: TaskRow[], clock: Clock): DaySchedulePayload {
	const schedule = placeOnDay({
		events: collectDayEvents(view.schedule),
		tasks,
		dateIso: view.dateIso,
		tz: clock.tz,
	});
	return { ...view, schedule };
}

export const dayView: ViewAdapter<"day"> = {
	kind: "task",
	fromSeed: (data) => ({ base: data, params: undefined }),
	rowsOf: (view) => collectDayTasks(view.schedule),
	reduce: (view, intent: TaskIntent, ctx) => {
		const pool = applyDayTaskList(collectDayTasks(view.schedule), intent, {
			todayIso: ctx.todayIso,
			top3DateIso: view.dateIso,
			nowIso: ctx.nowIso,
		});
		// ADR-0038 rule 2: a finished task stays struck on today's view only; a
		// cached other day drops it (its completion does not fall on that day).
		const tasks =
			intent.type === "complete" && view.dateIso !== ctx.todayIso
				? pool.filter((t) => t.id !== intent.id)
				: pool;
		return replace(view, tasks, ctx);
	},
	upsert: (view, rows, clock) => {
		const pool = collectDayTasks(view.schedule);
		let tasks = pool;
		for (const row of rows) {
			if (tasks.some((t) => t.id === row.id)) {
				tasks = replaceById(tasks, row);
				continue;
			}
			// Open rows are always offered; placement decides (the ADR-0059
			// successor lands here). A done row only when it was finished that day.
			const admit =
				row.status === "open" ||
				(row.completed_at != null && dateOfInstant(row.completed_at, clock.tz) === view.dateIso);
			if (admit) tasks = [...tasks, row];
		}
		return tasks === pool ? view : replace(view, tasks, clock);
	},
	remove: (view, ids, clock) => {
		const pool = collectDayTasks(view.schedule);
		const tasks = without(pool, ids);
		return tasks === pool ? view : replace(view, tasks, clock);
	},
	patch: (view, rowOf, clock) => {
		const pool = collectDayTasks(view.schedule);
		const tasks = patchRows(pool, rowOf);
		return tasks === pool ? view : replace(view, tasks, clock);
	},
};
