// Client-safe placement module, not `@/lib/services/today` — this file runs in
// the browser (day-bands.tsx), and the service module is `server-only`.
import { type DaySchedule, placeOnDay } from "@/lib/day-schedule";
import { isRecurrencePattern, nextDueDate } from "@/lib/recurrence";
import type { CalendarEventRow } from "@/lib/schemas/calendar";
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
	 * star: a completed recurring task still rolls forward from the real today.
	 */
	top3DateIso?: string;
	/** App timezone — required for day membership (placeOnDay). */
	tz?: string;
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

function top3Target(ctx: ApplyContext): string {
	return ctx.top3DateIso ?? ctx.todayIso;
}

function nowOf(ctx: ApplyContext): string {
	return ctx.nowIso ?? new Date().toISOString();
}

/**
 * Field-level complete projection shared by Tasks and Day surfaces.
 * Placement (move to done vs stay in place) is the caller's job.
 *
 * `clearTop3` is true on the Tasks page only — a shortlist cosmetic the server
 * never writes. Clearing it on Today would flash a starred row out of Top 3
 * and back in on the next RSC render (docs/adr/0038).
 */
export function completeTaskFields(
	task: TaskRow,
	ctx: ApplyContext,
	opts: { clearTop3: boolean },
): TaskRow {
	if (task.recurrence_rule && isRecurrencePattern(task.recurrence_rule)) {
		return {
			...task,
			due_date: nextDueDate({
				currentDue: task.due_date,
				rule: task.recurrence_rule,
				todayIso: ctx.todayIso,
			}),
		};
	}
	return {
		...task,
		status: "done",
		completed_at: nowOf(ctx),
		...(opts.clearTop3 ? { top3_for_date: null } : {}),
	};
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
 * Pure — same recurrence roll math as completeTask (lib/recurrence.nextDueDate).
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

			const next = completeTaskFields(task, ctx, { clearTop3: true });
			if (next.status === "open") {
				// Recurrence roll — stays open with a new due date.
				return {
					open: mapId(lists.open, intent.id, () => next),
					done: withoutId(lists.done, intent.id),
				};
			}
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
 * work on screen (docs/adr/0038). Prefer {@link applyDayIntent} when you have
 * a full DaySchedule — that one also re-bands membership.
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

/** Flatten every task the day currently shows, deduped by id. */
export function collectDayTasks(schedule: DaySchedule): TaskRow[] {
	const byId = new Map<string, TaskRow>();
	for (const item of schedule.allDay) {
		if (item.kind === "task") byId.set(item.task.id, item.task);
	}
	for (const item of schedule.timeline) {
		if (item.kind === "task") byId.set(item.task.id, item.task);
	}
	for (const task of schedule.top3) {
		byId.set(task.id, task);
	}
	for (const task of schedule.open) {
		byId.set(task.id, task);
	}
	return [...byId.values()];
}

/** Events currently on the day schedule (all-day + timeline). */
export function collectDayEvents(schedule: DaySchedule): CalendarEventRow[] {
	const out: CalendarEventRow[] = [];
	for (const item of schedule.allDay) {
		if (item.kind === "event") out.push(item.event);
	}
	for (const item of schedule.timeline) {
		if (item.kind === "event") out.push(item.event);
	}
	return out;
}

/**
 * One pure seam for Today's optimistic day bands: intent + base schedule →
 * next schedule. Field patch here; band membership via {@link placeOnDay}
 * so SSR and optimistic share one rule set.
 */
export function applyDayIntent(
	schedule: DaySchedule,
	intent: TaskIntent,
	ctx: ApplyContext,
): DaySchedule {
	const dateIso = top3Target(ctx);
	const tz = ctx.tz ?? "UTC";
	const tasks = applyDayTaskList(collectDayTasks(schedule), intent, ctx);
	return placeOnDay({
		events: collectDayEvents(schedule),
		tasks,
		dateIso,
		tz,
	});
}
