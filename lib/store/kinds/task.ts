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
import { projectTask, snapshotOf, type TaskIntent } from "@/lib/task-interaction/apply-intent";
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
 * was never loaded, and then nothing moves. `snapshot` is the done row a
 * recurring tick saves (docs/adr/0083); it is counted even when the tick
 * named no id for it, because the server saves it all the same.
 */
function afterIntent(
	intent: TaskIntent,
	before: TaskRow | undefined,
	ctx: IntentCtx,
): { after: TaskRow | undefined; snapshot: TaskRow | undefined } {
	if (intent.type === "create") return { after: intent.task, snapshot: undefined };
	if (!before) return { after: undefined, snapshot: undefined };
	const after = projectTask(before, intent, ctx);
	const counted =
		intent.type === "complete" ? { ...intent, snapshotId: intent.snapshotId ?? "counted" } : intent;
	return { after, snapshot: snapshotOf(before, counted, ctx) };
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
	// No row, nothing to move; a create the store already holds (a seed read
	// a received row first) is already counted.
	if (intent.type === "create" ? before !== undefined : !before) return {};
	const { after, snapshot } = afterIntent(intent, before, ctx);
	const was = intent.type === "create" ? NONE : countsOf(before, ctx);
	const now = countsOf(after, ctx);
	const out: Deltas = {};
	// A snapshot is done, so it never moves the open counts.
	const open = now.open - was.open;
	const overdue = now.overdue - was.overdue;
	const inbox = now.inbox - was.inbox;
	if (open !== 0) out["tasks.open"] = open;
	if (overdue !== 0) out["tasks.overdue"] = overdue;
	if (inbox !== 0) out["tasks.inbox"] = inbox;
	// A project's done and open counts (/projects, Today's rings): the row
	// leaving one, the row arriving in another, and the done snapshot a
	// recurring tick saves.
	const move = (key: `project.${"done" | "open"}:${string}`, by: number) => {
		const next = (out[key] ?? 0) + by;
		if (next === 0) delete out[key];
		else out[key] = next;
	};
	const prior = intent.type === "create" ? undefined : before;
	for (const [row, by] of [
		[prior, -1],
		[after, 1],
		[snapshot, 1],
	] as const) {
		if (row?.project_id == null) continue;
		if (row.status === "done") move(`project.done:${row.project_id}`, by);
		else if (row.status === "open") move(`project.open:${row.project_id}`, by);
	}
	return out;
}

/**
 * The server's answer can say the intent did not happen, or happened another
 * way; the counters follow what it says.
 *
 * - A tick the server refused (ADR-0037: the row moved on since it was seen)
 *   comes back open with no snapshot, so the counters it moved move back. A
 *   recurring tick that landed comes back open too, but with its snapshot.
 * - A skip the server refused leaves the row on the cycle the click saw.
 * - A reopen that un-ticked the latest snapshot of a recurring task
 *   (docs/adr/0083) deleted that snapshot instead of reopening it: only its
 *   project's done count moves. The recurring row's own move back is left to
 *   the next seed.
 */
function settleTaskDeltas(intent: TaskIntent, write: StoreWrite<TaskRow>, deltas: Deltas): Deltas {
	const rowOf = (id: string) => write.rows.find((r) => r.id === id);
	switch (intent.type) {
		case "complete":
			if (intent.snapshotId && write.rows.some((r) => r.id === intent.snapshotId)) return deltas;
			return rowOf(intent.id)?.status === "open" ? {} : deltas;
		case "skip":
			return rowOf(intent.id)?.due_date === intent.observedDueDate ? {} : deltas;
		case "reopen": {
			if (!write.deletedIds?.includes(intent.id)) return deltas;
			const out: Deltas = {};
			for (const [key, by] of Object.entries(deltas) as [keyof Deltas, number][]) {
				if (key.startsWith("project.done:")) out[key] = by;
			}
			return out;
		}
		default:
			return deltas;
	}
}

export const taskKind: KindAdapter<"task"> = {
	idOf: (row) => row.id,
	targetId: (intent) => (intent.type === "create" ? intent.task.id : intent.id),
	provisionalIds: (intent) => {
		if (intent.type === "create") return [intent.task.id];
		// A recurring tick's snapshot shows before the server has written it.
		if (intent.type === "complete" && intent.snapshotId) return [intent.snapshotId];
		return [];
	},
	// For counting only. A pending delete leaves no row, so a later intent on
	// it — a second delete, a tick — counts nothing: the delete already took
	// its counts away.
	project: projectTask,
	deltas: taskDeltas,
	settle: settleTaskDeltas,
};

/**
 * Whether a list already holds a create's row: a seed read while the create
 * committed can, since its `readAt` is stamped before the read.
 */
function holds(rows: TaskRow[], id: string): boolean {
	return rows.some((r) => r.id === id);
}

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

/**
 * A recurring tick's done snapshot (docs/adr/0083), added where `wants` it.
 * Projected from the clicked row as `pool` held it before the intent.
 */
function withSnapshot(
	rows: TaskRow[],
	pool: TaskRow[],
	intent: TaskIntent,
	ctx: IntentCtx,
	wants: (snapshot: TaskRow) => boolean,
): TaskRow[] {
	if (intent.type !== "complete") return rows;
	const row = pool.find((r) => r.id === intent.id);
	const snapshot = row && snapshotOf(row, intent, ctx);
	if (!snapshot || holds(rows, snapshot.id) || !wants(snapshot)) return rows;
	return [snapshot, ...rows];
}

/**
 * A reopen of a recurring tick's done snapshot (docs/adr/0083). The server
 * un-ticks it if it is the series' latest — the snapshot goes and the series
 * row moves back — or reopens it as a plain task if it is older. The client
 * cannot tell which, so the snapshot leaves every view until the answer
 * brings back what is true. Shown as an open task meanwhile, it would be a
 * second copy of the series to tick.
 */
function untickHides(intent: TaskIntent, row: TaskRow | undefined): boolean {
	return intent.type === "reopen" && row?.status === "done" && row.series_id !== null;
}

/** The rows without a snapshot whose reopen is pending; same array when there is none. */
function withoutUntick(rows: TaskRow[], intent: TaskIntent): TaskRow[] {
	if (intent.type !== "reopen") return rows;
	const row = rows.find((r) => r.id === intent.id);
	return untickHides(intent, row) ? without(rows, new Set([intent.id])) : rows;
}

export const taskListsView: ViewAdapter<"taskLists"> = {
	kind: "task",
	fromSeed: (data) => ({ base: data, params: undefined }),
	rowsOf: (view) => [...view.open, ...view.done],
	reduce: (view, intent, ctx) => {
		if (intent.type === "create") {
			if (holds([...view.open, ...view.done], intent.task.id)) return view;
			return { open: [intent.task, ...view.open], done: view.done };
		}
		if (intent.type === "complete" || intent.type === "reopen") {
			// A tick or an untick moves the row between the lists, to the top.
			const row = [...view.open, ...view.done].find((r) => r.id === intent.id);
			const gone = new Set([intent.id]);
			if (untickHides(intent, row)) {
				return { open: without(view.open, gone), done: without(view.done, gone) };
			}
			const next = row && projectTask(row, intent, ctx);
			if (!row || !next || next === row) return view;
			// A recurring tick keeps the row open where it is, on its next cycle,
			// and its done snapshot leads the done list (docs/adr/0083).
			const snapshot = snapshotOf(row, intent, ctx);
			if (snapshot) {
				return {
					open: replaceById(view.open, next),
					done: holds(view.done, snapshot.id)
						? view.done
						: [snapshot, ...view.done].slice(0, DONE_CAP),
				};
			}
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
			// A row the server made — a recurring tick's snapshot when the tick
			// named no id for it (docs/adr/0083) — appears here.
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
			return inTaskScope(intent.task, scope) && !holds(view, intent.task.id)
				? [intent.task, ...view]
				: view;
		}
		const out = withSnapshot(
			projectRows(withoutUntick(view, intent), intent, ctx),
			view,
			intent,
			ctx,
			(snapshot) => inTaskScope(snapshot, scope),
		);
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
				? onDay(intent.task, view, ctx) && !holds(pool, intent.task.id)
					? [intent.task, ...pool]
					: pool
				: withoutQuiet(projectRows(withoutUntick(pool, intent), intent, ctx), ctx);
		// ADR-0038 rule 2: a finished task stays struck on today's view only; a
		// cached other day drops it (its completion does not fall on that day).
		// A recurring tick leaves its row open on the next cycle, where
		// placement puts it, and its done snapshot is the struck row.
		if (intent.type === "complete" && view.dateIso !== ctx.todayIso) {
			const row = tasks.find((t) => t.id === intent.id);
			if (row?.status === "done") tasks = without(tasks, new Set([intent.id]));
		}
		tasks = withSnapshot(tasks, pool, intent, ctx, (snapshot) => onDay(snapshot, view, ctx));
		return tasks === pool ? view : replace(view, tasks, ctx);
	},
	upsert: (view, rows, clock) => {
		const pool = collectDayTasks(view.schedule);
		let tasks = pool;
		for (const row of rows) {
			const held = tasks.some((t) => t.id === row.id);
			// An open row that went quiet leaves; any other row the day already
			// holds is patched in place, done or not (ADR-0038). A row the day
			// would read is offered, and placement decides (a recurring tick's
			// snapshot lands here when the client did not project it).
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
