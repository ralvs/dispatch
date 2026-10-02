// The task kind. What an intent does to one row is projectTask
// (lib/task-interaction/apply-intent.ts); everything here is where that row
// then sits — /tasks' open and done lists, a scoped list, a day's bands — and
// what it does to Today's counters.

import { dateOfInstant } from "@/lib/dates";
import {
	collectDayEvents,
	collectDayTasks,
	type DaySchedulePayload,
	placeOnDay,
} from "@/lib/day-schedule";
import { isQuiet } from "@/lib/quiet";
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
import { projectTask, type TaskIntent } from "@/lib/task-interaction/apply-intent";
import { isOverdue } from "@/lib/task-predicates";

/** /tasks: the open list and the recently done strip. */
export type TaskLists = {
	open: TaskRow[];
	done: TaskRow[];
};

/** How many finished rows /tasks keeps. */
const DONE_CAP = 10;

type TaskCounts = { open: number; overdue: number; inbox: number };
const NONE: TaskCounts = { open: 0, overdue: 0, inbox: 0 };

/** The quiet projects the server last told the store about (lib/quiet.ts). */
function quietOf(clock: Clock): ReadonlySet<string> {
	return new Set(clock.quietProjectIds);
}

/**
 * What one row adds to Today's counters (lib/services/today.ts
 * assembleTodayView). Today reads its tasks without the quiet ones, so a quiet
 * row adds nothing.
 */
function countsOf(row: TaskRow | undefined, clock: Clock): TaskCounts {
	if (row?.status !== "open" || isQuiet(row, quietOf(clock))) return NONE;
	return {
		open: 1,
		overdue: isOverdue(row, clock.todayIso) ? 1 : 0,
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
	const after = projectTask(before, intent, ctx);
	const recurring =
		intent.type === "complete" &&
		before.recurrence_rule !== null &&
		after?.recurrence_rule === null;
	return { after, successor: recurring ? { ...before, due_date: null } : undefined };
}

/**
 * Today's counters move with the intent. An edit moves nothing here — its
 * new due date is only known once the server answers — and the next seed
 * heals it.
 *
 * `before` is the row as the user sees it, every pending intent folded on
 * (`project` below): a tick then an untick before either answers moves the
 * count down and back up, not down twice.
 */
function taskDeltas(intent: TaskIntent, before: TaskRow | undefined, ctx: IntentCtx): Deltas {
	if (intent.type !== "create" && !before) return {};
	const { after, successor } = afterIntent(intent, before, ctx);
	const was = intent.type === "create" ? NONE : countsOf(before, ctx);
	const now = countsOf(after, ctx);
	const next = countsOf(successor, ctx);
	const out: Deltas = {};
	const open = now.open + next.open - was.open;
	const overdue = now.overdue + next.overdue - was.overdue;
	const inbox = now.inbox + next.inbox - was.inbox;
	if (open !== 0) out["tasks.open"] = open;
	if (overdue !== 0) out["tasks.overdue"] = overdue;
	if (inbox !== 0) out["tasks.inbox"] = inbox;
	// A project's done and open counts (/projects, Today's rings): the row
	// leaving one, the row arriving in another, and the open occurrence a
	// recurring completion leaves behind.
	const move = (key: `project.${"done" | "open"}:${string}`, by: number) => {
		const next = (out[key] ?? 0) + by;
		if (next === 0) delete out[key];
		else out[key] = next;
	};
	const prior = intent.type === "create" ? undefined : before;
	for (const [row, by] of [
		[prior, -1],
		[after, 1],
		[successor, 1],
	] as const) {
		if (row?.project_id == null) continue;
		if (row.status === "done") move(`project.done:${row.project_id}`, by);
		else if (row.status === "open") move(`project.open:${row.project_id}`, by);
	}
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
	targetId: (intent) => (intent.type === "create" ? intent.task.id : intent.id),
	provisionalIds: (intent) => (intent.type === "create" ? [intent.task.id] : []),
	// For counting only. A pending delete leaves no row, so a later intent on
	// it — a second delete, a tick — counts nothing: the delete already took
	// its counts away.
	project: projectTask,
	deltas: taskDeltas,
	settle: settleTaskDeltas,
};

/** Every row through the intent; a deleted one drops. Same array when nothing changed. */
function projectRows(rows: TaskRow[], intent: TaskIntent, ctx: IntentCtx): TaskRow[] {
	let changed = false;
	const out: TaskRow[] = [];
	for (const row of rows) {
		const next = projectTask(row, intent, ctx);
		if (next !== row) changed = true;
		if (next) out.push(next);
	}
	return changed ? out : rows;
}

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
	reduce: (view, intent, ctx) => {
		if (intent.type === "create") return { open: [intent.task, ...view.open], done: view.done };
		if (intent.type === "complete" || intent.type === "reopen") {
			// A tick or an untick moves the row between the lists, to the top.
			const row = [...view.open, ...view.done].find((r) => r.id === intent.id);
			const next = row && projectTask(row, intent, ctx);
			if (!row || !next || next === row) return view;
			const gone = new Set([row.id]);
			if (next.status === "open") {
				return { open: [next, ...without(view.open, gone)], done: without(view.done, gone) };
			}
			// The star is a shortlist cosmetic here, and the server never clears
			// it: the confirmed row brings it back. Today keeps it (docs/adr/0038).
			const closed = { ...next, top3_for_date: null };
			return {
				open: without(view.open, gone),
				done: [closed, ...without(view.done, gone)].slice(0, DONE_CAP),
			};
		}
		const open = projectRows(view.open, intent, ctx);
		const done = projectRows(view.done, intent, ctx);
		return open === view.open && done === view.done ? view : { open, done };
	},
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
	if ("anyProject" in scope) return row.project_id !== null;
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
		if (intent.type === "create") {
			return inTaskScope(intent.task, scope) ? [intent.task, ...view] : view;
		}
		const out = projectRows(view, intent, ctx);
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

/**
 * Whether a day reads this row, as lib/services/today.ts does: the open tasks
 * that are not quiet, and every task finished that day — quiet or not, since
 * the day keeps what was finished on it (ADR-0038).
 */
function onDay(row: TaskRow, view: DaySchedulePayload, clock: Clock): boolean {
	if (row.status === "open") return !isQuiet(row, quietOf(clock));
	return row.completed_at != null && dateOfInstant(row.completed_at, clock.tz) === view.dateIso;
}

/** An open row the day no longer reads, because it went quiet. */
function wentQuiet(row: TaskRow, clock: Clock): boolean {
	return row.status === "open" && isQuiet(row, quietOf(clock));
}

/** The pool without the open rows that went quiet: an untick on a finished quiet task. */
function withoutQuiet(tasks: TaskRow[], clock: Clock): TaskRow[] {
	return tasks.some((t) => wentQuiet(t, clock)) ? tasks.filter((t) => !wentQuiet(t, clock)) : tasks;
}

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
		const pool = collectDayTasks(view.schedule);
		// A create is offered to every day it belongs on; placement decides
		// where it sits.
		let tasks =
			intent.type === "create"
				? onDay(intent.task, view, ctx)
					? [intent.task, ...pool]
					: pool
				: withoutQuiet(projectRows(pool, intent, ctx), ctx);
		// ADR-0038 rule 2: a finished task stays struck on today's view only; a
		// cached other day drops it (its completion does not fall on that day).
		if (intent.type === "complete" && view.dateIso !== ctx.todayIso) {
			tasks = without(tasks, new Set([intent.id]));
		}
		return tasks === pool ? view : replace(view, tasks, ctx);
	},
	upsert: (view, rows, clock) => {
		const pool = collectDayTasks(view.schedule);
		let tasks = pool;
		for (const row of rows) {
			const held = tasks.some((t) => t.id === row.id);
			// An open row that went quiet leaves; any other row the day already
			// holds is patched in place, done or not (ADR-0038). A row the day
			// would read is offered, and placement decides (the ADR-0059
			// successor lands here).
			if (held && wentQuiet(row, clock)) {
				tasks = without(tasks, new Set([row.id]));
			} else if (held) {
				tasks = replaceById(tasks, row);
			} else if (onDay(row, view, clock)) {
				tasks = [...tasks, row];
			}
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
		const tasks = withoutQuiet(patchRows(pool, rowOf), clock);
		return tasks === pool ? view : replace(view, tasks, clock);
	},
};
