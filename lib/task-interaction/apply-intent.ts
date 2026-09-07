// Field-level projectors for task intents. Day membership lives in
// lib/day-schedule.ts (applyDayIntent). This module stays client-safe.
import { isRecurrenceRule, nextDueDate } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/schemas/task";

/** Intents the optimistic layer understands (v1). Edit waits for the server. */
/** Optimistic + write payload — one contract for projector, lock, and action. */
export type TaskIntent =
	| { type: "complete"; id: string; observedDueDate: string | null }
	| { type: "reopen"; id: string }
	| { type: "setTop3"; id: string; starred: boolean; forDateIso: string }
	| { type: "delete"; id: string }
	| { type: "create"; task: TaskRow };

export type ApplyContext = {
	todayIso: string;
	/**
	 * Which day a ☆ toggle pins to. Defaults to todayIso. Today's day navigation
	 * passes the day on screen — the two part company there, and only for the
	 * star: a recurring task's next occurrence is dated from the real today.
	 */
	top3DateIso?: string;
	/** ISO instant for completed_at; defaults to now when omitted. */
	nowIso?: string;
};

export type TaskLists = {
	open: TaskRow[];
	done: TaskRow[];
};

function mapId(tasks: TaskRow[], id: string, fn: (t: TaskRow) => TaskRow): TaskRow[] {
	return tasks.map((t) => (t.id === id ? fn(t) : t));
}

function withoutId(tasks: TaskRow[], id: string): TaskRow[] {
	return tasks.filter((t) => t.id !== id);
}

function findIn(tasks: TaskRow[], id: string): TaskRow | undefined {
	return tasks.find((t) => t.id === id);
}

function nowOf(ctx: Pick<ApplyContext, "nowIso">): string {
	return ctx.nowIso ?? new Date().toISOString();
}

/**
 * What completing a task writes.
 *
 * Every completion closes its row, recurring included (docs/adr/0059). A
 * recurring row additionally hands back `spawn` — the due date of the next
 * occurrence, which the server materialises as a NEW row. The completed row
 * keeps its history (title, notes, completed_at, the day it was starred for)
 * and gives up its rule: `recurrence_rule` moves to the spawned row, so
 * re-opening and re-ticking the old occurrence can never spawn a second one.
 */
export type CompleteProjection = {
	completed_at: string;
	/** Non-null only for a recurring row: the next occurrence to create. */
	spawn: { due_date: string | null } | null;
};

/**
 * The one complete projector. Tasks-page cosmetics (clearTop3) sit outside it.
 */
export function nextCompleteFields(
	task: { recurrence_rule: string | null; due_date: string | null },
	ctx: Pick<ApplyContext, "todayIso" | "nowIso">,
): CompleteProjection {
	// isRecurrenceRule, not isRecurrencePattern: a custom weekly rule must
	// spawn like any other. Guarding on the seven literals let an unknown rule
	// fall through to a plain close, silently ending the series (shape plan §06).
	const spawn =
		task.recurrence_rule && isRecurrenceRule(task.recurrence_rule)
			? {
					due_date: nextDueDate({
						currentDue: task.due_date,
						rule: task.recurrence_rule,
						todayIso: ctx.todayIso,
					}),
				}
			: null;
	return { completed_at: nowOf(ctx), spawn };
}

export function projectComplete(
	task: TaskRow,
	ctx: Pick<ApplyContext, "todayIso" | "nowIso">,
): TaskRow {
	const fields = nextCompleteFields(task, ctx);
	return {
		...task,
		status: "done",
		completed_at: fields.completed_at,
		// The rule leaves with the spawned occurrence.
		recurrence_rule: fields.spawn ? null : task.recurrence_rule,
	};
}

/**
 * Field-level complete projection shared by Tasks and Day surfaces.
 * Placement (move to done vs stay in place) is the caller's job.
 *
 * `clearTop3` is true on the Tasks page only — a shortlist cosmetic the server
 * never writes. Clearing it on Today would flash a starred row out of Top 3
 * and back in on the next RSC render (docs/adr/0038).
 *
 * The spawned occurrence is deliberately NOT projected here: it is a server-
 * generated row with a server-generated id, so the optimistic pass closes the
 * ticked row and lets the RSC payload deliver its successor.
 */
export function completeTaskFields(
	task: TaskRow,
	ctx: ApplyContext,
	opts: { clearTop3: boolean },
): TaskRow {
	const next = projectComplete(task, ctx);
	if (opts.clearTop3 && next.status === "done") {
		return { ...next, top3_for_date: null };
	}
	return next;
}

export function reopenTaskFields(task: TaskRow): TaskRow {
	return { ...task, status: "open", completed_at: null };
}

/** Desired-state star — matches setTop3 on the server (docs/adr/0037). */
export function setTop3Fields(task: TaskRow, starred: boolean, forDateIso: string): TaskRow {
	if (starred) return { ...task, top3_for_date: forDateIso };
	if (task.top3_for_date !== forDateIso) return task;
	return { ...task, top3_for_date: null };
}

/**
 * Project open+done lists for the Tasks page after an intent.
 * Pure — same next-occurrence math as completeTask (lib/recurrence.nextDueDate).
 */
export function applyTaskLists(lists: TaskLists, intent: TaskIntent, ctx: ApplyContext): TaskLists {
	switch (intent.type) {
		case "create": {
			return { open: [intent.task, ...lists.open], done: lists.done };
		}
		case "delete": {
			return {
				open: withoutId(lists.open, intent.id),
				done: withoutId(lists.done, intent.id),
			};
		}
		case "setTop3": {
			const patch = (t: TaskRow): TaskRow => setTop3Fields(t, intent.starred, intent.forDateIso);
			return {
				open: mapId(lists.open, intent.id, patch),
				done: mapId(lists.done, intent.id, patch),
			};
		}
		case "reopen": {
			const task = findIn(lists.done, intent.id) ?? findIn(lists.open, intent.id);
			if (!task) return lists;
			const reopened = reopenTaskFields(task);
			return {
				open: [reopened, ...withoutId(lists.open, intent.id)],
				done: withoutId(lists.done, intent.id),
			};
		}
		case "complete": {
			const task = findIn(lists.open, intent.id) ?? findIn(lists.done, intent.id);
			if (!task) return lists;

			// Every completion closes, recurring included. The next occurrence is a
			// separate row the server creates; it arrives with the RSC payload.
			const next = completeTaskFields(task, ctx, { clearTop3: true });
			return {
				open: withoutId(lists.open, intent.id),
				done: [next, ...withoutId(lists.done, intent.id)].slice(0, 10),
			};
		}
	}
}

/**
 * Project a flat day-task list after an intent, in place.
 *
 * Completing a task does NOT drop it: Today's bands keep the day's finished
 * work on screen (docs/adr/0038) — which is now also what makes a past day
 * honest about a recurring task that was ticked on it. Re-band via
 * applyDayIntent in day-schedule.
 */
export function applyDayTaskList(
	tasks: TaskRow[],
	intent: TaskIntent,
	ctx: ApplyContext,
): TaskRow[] {
	switch (intent.type) {
		case "create":
			return [intent.task, ...tasks];
		case "delete":
			return withoutId(tasks, intent.id);
		case "setTop3":
			return mapId(tasks, intent.id, (t) => setTop3Fields(t, intent.starred, intent.forDateIso));
		case "reopen":
			return mapId(tasks, intent.id, reopenTaskFields);
		case "complete":
			return mapId(tasks, intent.id, (t) => completeTaskFields(t, ctx, { clearTop3: false }));
	}
}
