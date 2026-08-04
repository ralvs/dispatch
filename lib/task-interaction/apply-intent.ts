import { isRecurrencePattern, nextDueDate } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/schemas/task";
import type { DaySchedule, DayScheduleItem } from "@/lib/services/today";
import { isTop3Today } from "@/lib/task-predicates";

/** Intents the optimistic layer understands (v1). Edit waits for the server. */
export type TaskIntent =
	| { type: "complete"; id: string }
	| { type: "reopen"; id: string }
	| { type: "toggleTop3"; id: string }
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

export function toggleTop3Fields(task: TaskRow, ctx: ApplyContext): TaskRow {
	const target = top3Target(ctx);
	return {
		...task,
		top3_for_date: task.top3_for_date === target ? null : target,
	};
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
		case "toggleTop3": {
			const patch = (t: TaskRow): TaskRow => toggleTop3Fields(t, ctx);
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
		case "toggleTop3":
			return mapId(tasks, intent.id, (t) => toggleTop3Fields(t, ctx));
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

/**
 * Re-band a day schedule from an optimistic flat task list.
 *
 * Status is deliberately not a filter: done rows stay where they were
 * (docs/adr/0038). A recurring task that rolls its due date leaves the day.
 */
export function projectDaySchedule(
	schedule: DaySchedule,
	tasks: TaskRow[],
	dateIso: string,
): DaySchedule {
	const byId = new Map(tasks.map((t) => [t.id, t]));

	function mapItems(items: DayScheduleItem[]): DayScheduleItem[] {
		const out: DayScheduleItem[] = [];
		for (const item of items) {
			if (item.kind !== "task") {
				out.push(item);
				continue;
			}
			const next = byId.get(item.task.id);
			// A recurring task rolls to its next due date on completion, which
			// takes it off this day for real — that is the one removal left.
			if (!next || next.due_date !== item.task.due_date) continue;
			out.push({ ...item, task: next });
		}
		return out;
	}

	// Top 3 re-derives from the optimistic list rather than from schedule.top3,
	// so tapping ☆ on any band moves the row into (or out of) the shortlist
	// immediately instead of waiting for the Today RSC round-trip.
	const top3 = tasks.filter((t) => isTop3Today(t, dateIso));

	// Open carries the leftovers only — a row promoted to Top 3 leaves this band
	// in the same tick it joins that one, so it never shows up twice.
	const openBand: TaskRow[] = [];
	for (const t of schedule.open) {
		const next = byId.get(t.id);
		if (!next || next.due_date !== t.due_date) continue; // rolled off the day
		if (!isTop3Today(next, dateIso)) openBand.push(next);
	}

	return {
		allDay: mapItems(schedule.allDay),
		timeline: mapItems(schedule.timeline),
		top3,
		open: openBand,
	};
}

/**
 * One pure seam for Today's optimistic day bands: intent + base schedule →
 * next schedule. Field patch and band membership live here so React only
 * dispatches.
 */
export function applyDayIntent(
	schedule: DaySchedule,
	intent: TaskIntent,
	ctx: ApplyContext,
): DaySchedule {
	const dateIso = top3Target(ctx);
	const tasks = applyDayTaskList(collectDayTasks(schedule), intent, ctx);
	return projectDaySchedule(schedule, tasks, dateIso);
}
