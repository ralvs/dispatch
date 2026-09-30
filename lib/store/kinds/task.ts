// The task kind: three view types built on the existing reducers, so the store
// and the pre-store optimistic layer cannot drift on what an intent means.

import { dateOfInstant } from "@/lib/dates";
import {
	applyDayIntent,
	collectDayEvents,
	collectDayTasks,
	type DaySchedulePayload,
	placeOnDay,
} from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/schemas/task";
import type {
	Clock,
	Deltas,
	IntentCtx,
	KindAdapter,
	RowEntry,
	StoreWrite,
	TaskScope,
	ViewAdapter,
} from "@/lib/store/types";
import {
	applyDayTaskList,
	applyTaskLists,
	assignDomainFields,
	projectComplete,
	reopenTaskFields,
	type TaskIntent,
} from "@/lib/task-interaction/apply-intent";
import { isOverdue } from "@/lib/task-predicates";

/** How many finished rows /tasks keeps (mirrors applyTaskLists). */
const DONE_CAP = 10;

type TaskCounts = { open: number; overdue: number; inbox: number };
const NONE: TaskCounts = { open: 0, overdue: 0, inbox: 0 };

/** What one row adds to Today's counters (lib/services/today.ts assembleTodayView). */
function countsOf(row: TaskRow | undefined, todayIso: string): TaskCounts {
	if (row?.status !== "open") return NONE;
	return {
		open: 1,
		overdue: isOverdue(row, todayIso) ? 1 : 0,
		inbox: row.domain_id === null ? 1 : 0,
	};
}

/**
 * The row after the intent, for counting; `before` is undefined when the row
 * was never loaded, and then nothing moves. `successor` is the next occurrence
 * a recurring completion creates (docs/adr/0059): open, not overdue — it is
 * dated from today — and filed where its source was.
 */
function afterIntent(
	intent: TaskIntent,
	before: TaskRow | undefined,
	ctx: IntentCtx,
): { after: TaskRow | undefined; successor: TaskRow | undefined } {
	if (intent.type === "create") return { after: intent.task, successor: undefined };
	if (!before) return { after: undefined, successor: undefined };
	switch (intent.type) {
		case "complete": {
			if (before.status !== "open") return { after: before, successor: undefined };
			const after = projectComplete(before, ctx);
			const recurring = before.recurrence_rule !== null && after.recurrence_rule === null;
			return { after, successor: recurring ? { ...before, due_date: null } : undefined };
		}
		case "reopen":
			return { after: reopenTaskFields(before), successor: undefined };
		case "assign":
			return { after: assignDomainFields(before, intent.domainId), successor: undefined };
		case "delete":
			return { after: undefined, successor: undefined };
		case "setTop3":
		case "edit":
			return { after: before, successor: undefined };
	}
}

/**
 * Today's counters move with the intent. An edit moves nothing here — its
 * new due date is only known once the server answers — and the next seed
 * heals it. So does a quiet task (lib/task-predicates.ts isQuiet): the store
 * cannot tell one from its row, and Today does not count them.
 */
function taskDeltas(intent: TaskIntent, before: TaskRow | undefined, ctx: IntentCtx): Deltas {
	if (intent.type !== "create" && !before) return {};
	const { after, successor } = afterIntent(intent, before, ctx);
	const was = intent.type === "create" ? NONE : countsOf(before, ctx.todayIso);
	const now = countsOf(after, ctx.todayIso);
	const next = countsOf(successor, ctx.todayIso);
	const out: Deltas = {};
	const open = now.open + next.open - was.open;
	const overdue = now.overdue + next.overdue - was.overdue;
	const inbox = now.inbox + next.inbox - was.inbox;
	if (open !== 0) out["tasks.open"] = open;
	if (overdue !== 0) out["tasks.overdue"] = overdue;
	if (inbox !== 0) out["tasks.inbox"] = inbox;
	return out;
}

/**
 * A completion the server refused (ADR-0037: the row moved on since it was
 * seen) comes back still open, so the counters it moved move back. Done or
 * gone is what the intent predicted, and its deltas stand.
 *
 * One gap, left on purpose: a recurring row another tab already completed
 * comes back done with no successor in the write — nothing links a row to the
 * occurrence it spawned — so the next occurrence shows once a seed newer than
 * the write arrives.
 */
function settleTaskDeltas(intent: TaskIntent, write: StoreWrite<TaskRow>, deltas: Deltas): Deltas {
	if (intent.type !== "complete") return deltas;
	const row = write.rows.find((r) => r.id === intent.id);
	return row?.status === "open" ? {} : deltas;
}

export const taskKind: KindAdapter<"task"> = {
	idOf: (row) => row.id,
	provisionalIds: (intent) => (intent.type === "create" ? [intent.task.id] : []),
	deltas: taskDeltas,
	settle: settleTaskDeltas,
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
			// Placed by the server's status, not by where the intent put it: a
			// completion the server refused comes back open and must leave `done`.
			// A row already in the right list keeps its place.
			const want = row.status === "open" ? open : done;
			if (want.some((r) => r.id === row.id)) {
				if (row.status === "open") open = replaceById(open, row);
				else done = replaceById(done, row);
				continue;
			}
			open = without(open, new Set([row.id]));
			done = without(done, new Set([row.id]));
			// A recurring completion's successor (ADR-0059) is a server-made open
			// row, and this is how it appears.
			if (row.status === "open") open = [row, ...open];
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

/** Rows a write moved out of the list's scope leave it: a filed inbox task, a task moved to another project. */
function inScopeOnly(view: TaskRow[], scope: TaskScope | undefined): TaskRow[] {
	if (!scope) return view;
	return view.every((r) => inTaskScope(r, scope))
		? view
		: view.filter((r) => inTaskScope(r, scope));
}

export const taskListView: ViewAdapter<"taskList"> = {
	kind: "task",
	fromSeed: (data) => ({ base: data.rows, params: data.scope }),
	rowsOf: (view) => view,
	reduce: (view, intent, ctx, scope) => {
		// A create belongs only to the list whose scope it matches — without the
		// guard it would show in every cached project list.
		if (intent.type === "create" && !inTaskScope(intent.task, scope)) return view;
		const out = applyDayTaskList(view, intent, { todayIso: ctx.todayIso, nowIso: ctx.nowIso });
		return intent.type === "assign" ? inScopeOnly(out, scope) : out;
	},
	upsert: (view, rows, _clock, scope) => {
		let out = view;
		for (const row of rows) {
			if (out.some((r) => r.id === row.id)) out = replaceById(out, row);
			else if (inTaskScope(row, scope)) out = [row, ...out];
		}
		return inScopeOnly(out, scope);
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
		const schedule = applyDayIntent(view.schedule, intent, { ...ctx, dateIso: view.dateIso });
		const next = { ...view, schedule };
		// ADR-0038 rule 2: a finished task stays struck on today's view only; a
		// cached other day drops it (its completion does not fall on that day).
		if (intent.type !== "complete" || view.dateIso === ctx.todayIso) return next;
		const pool = collectDayTasks(schedule);
		const tasks = without(pool, new Set([intent.id]));
		return tasks === pool ? next : replace(next, tasks, ctx);
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
