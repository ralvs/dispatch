// ─── Day schedule (ADR-0014) ────────────────────────────────────────────
//
// One "when is my day" composition instead of a flat events card beside a
// separate task card. Three bands:
//
//   allDay   all-day events + tasks due today with no time on them
//   timeline timed events and timed tasks merged, ascending by clock time
//   open     top-3 and other tasks that want attention but sit nowhere
//
// Ordering runs on UTC instants, never on formatted strings: an event that
// began yesterday and runs into today keeps its real start, and a task's
// wall-clock due_time is resolved through the app timezone
// (instantFromLocal) rather than compared as text. Ties break events before
// tasks, then by title, so the same input always yields the same order.
//
// This module is deliberately client-safe — no `server-only`, no Supabase, no
// env. SSR reads it through lib/services/today.ts (which re-exports it) and
// the optimistic day bands import it directly from a client component; a
// server-only home would drag `env` into the browser graph and fail the build.

import { formatInstant, instantFromLocal, isWallClockTime } from "@/lib/dates";
import type { CalendarEventRow } from "@/lib/schemas/calendar";
import type { TaskRow } from "@/lib/schemas/task";
import { applyDayTaskList, type TaskIntent } from "@/lib/task-interaction/apply-intent";
import { isTop3Today } from "@/lib/task-predicates";

// `sortAt` is the UTC instant an item occupies on the timeline, and `time` its
// wall-clock rendering in the app timezone. All-day items have neither: they
// carry "" / null and order by kind then title inside their own band.
export type DayScheduleItem =
	| { kind: "event"; key: string; sortAt: string; time: string | null; event: CalendarEventRow }
	| { kind: "task"; key: string; sortAt: string; time: string | null; task: TaskRow };

export type DaySchedule = {
	allDay: DayScheduleItem[];
	timeline: DayScheduleItem[];
	/**
	 * Everything starred for today, whatever else it is. A starred task that
	 * also carries a due time deliberately appears here AND on the timeline:
	 * the timeline answers "when", this band answers "what matters". Dropping a
	 * task from it for having a clock time would misreport the day.
	 */
	top3: TaskRow[];
	open: TaskRow[];
};

/** Payload for client day-nav: schedule bands only, not the full Today digest. */
export type DaySchedulePayload = {
	schedule: DaySchedule;
	dateIso: string;
	nowUtcIso: string;
	nowLabel: string | null;
	eventNoteIds: Record<string, string>;
	taskNoteIds: Record<string, string>;
};

/** Cap on the open/unscheduled band. */
const OPEN_CAP = 10;

/**
 * A task's due time as a UTC instant, or null when it has no usable one.
 * Defensive rather than throwing: a malformed time demotes the task to the
 * all-day band instead of taking the whole Today read down with it.
 */
function taskDueInstant(task: TaskRow, todayIso: string, tz: string): string | null {
	if (task.due_time === null || !isWallClockTime(task.due_time)) return null;
	try {
		return instantFromLocal(todayIso, task.due_time, tz);
	} catch {
		return null;
	}
}

function compareItems(a: DayScheduleItem, b: DayScheduleItem): number {
	if (a.sortAt !== b.sortAt) return a.sortAt < b.sortAt ? -1 : 1;
	if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
	const titleA = a.kind === "event" ? a.event.title : a.task.title;
	const titleB = b.kind === "event" ? b.event.title : b.task.title;
	return titleA < titleB ? -1 : titleA > titleB ? 1 : 0;
}

/**
 * Day membership: which events/tasks sit in which band for one date.
 * One pure module used by SSR (`buildDaySchedule`) and the optimistic tick
 * (`applyDayIntent`) so placement cannot drift.
 *
 * `dateIso` is the day being shown. Placement never asks whether a task is
 * done (docs/adr/0038) — only where it belongs. A completed task still has to
 * be due by `dateIso` or starred for it to show.
 */
export function placeOnDay(input: {
	events: CalendarEventRow[];
	/** Open + completed-on-day, already merged. */
	tasks: TaskRow[];
	dateIso: string;
	tz: string;
}): DaySchedule {
	const { events, tasks, dateIso, tz } = input;

	const allDay: DayScheduleItem[] = [];
	const timeline: DayScheduleItem[] = [];

	for (const event of events) {
		if (event.all_day) {
			allDay.push({ kind: "event", key: `event:${event.id}`, sortAt: "", time: null, event });
			continue;
		}
		timeline.push({
			kind: "event",
			key: `event:${event.id}`,
			sortAt: event.start_at,
			time: formatInstant(event.start_at, tz, "HH:mm"),
			event,
		});
	}

	const dueToday = tasks.filter((t) => t.due_date === dateIso);
	for (const task of dueToday) {
		const at = taskDueInstant(task, dateIso, tz);
		if (at === null) {
			allDay.push({ kind: "task", key: `task:${task.id}`, sortAt: "", time: null, task });
			continue;
		}
		timeline.push({
			kind: "task",
			key: `task:${task.id}`,
			sortAt: at,
			time: formatInstant(at, tz, "HH:mm"),
			task,
		});
	}

	const placed = new Set(
		[...allDay, ...timeline].filter((i) => i.kind === "task").map((i) => i.task.id),
	);
	const unplaced = tasks.filter((t) => !placed.has(t.id));
	const top3 = tasks.filter((t) => isTop3Today(t, dateIso));
	const arrived = unplaced.filter(
		(t) => !isTop3Today(t, dateIso) && t.due_date !== null && t.due_date <= dateIso,
	);
	const arrivedOpen = arrived.filter((t) => t.status !== "done");
	const arrivedDone = arrived.filter((t) => t.status === "done");

	return {
		allDay: allDay.sort(compareItems),
		timeline: timeline.sort(compareItems),
		top3,
		open: [...arrivedOpen.slice(0, OPEN_CAP), ...arrivedDone],
	};
}

/**
 * Server/read path entry for day bands. Merges open + completed-on-day then
 * places via {@link placeOnDay}.
 */
export function buildDaySchedule(input: {
	events: CalendarEventRow[];
	openTasks: TaskRow[];
	/** Tasks whose `completed_at` falls on `dateIso`. Optional — omitted by
	 * callers (tests, briefings) that only care about what is still open. */
	completedTasks?: TaskRow[];
	dateIso: string;
	tz: string;
}): DaySchedule {
	return placeOnDay({
		events: input.events,
		tasks: [...input.openTasks, ...(input.completedTasks ?? [])],
		dateIso: input.dateIso,
		tz: input.tz,
	});
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

/** Membership date is first-class — not smuggled as the star's target. */
export type DayIntentContext = {
	dateIso: string;
	todayIso: string;
	tz: string;
	nowIso?: string;
};

/**
 * Intent + base schedule → next schedule. Field patch via applyDayTaskList;
 * band membership via placeOnDay so SSR and optimistic share one rule set.
 */
export function applyDayIntent(
	schedule: DaySchedule,
	intent: TaskIntent,
	ctx: DayIntentContext,
): DaySchedule {
	const tasks = applyDayTaskList(collectDayTasks(schedule), intent, {
		todayIso: ctx.todayIso,
		top3DateIso: ctx.dateIso,
		nowIso: ctx.nowIso,
	});
	return placeOnDay({
		events: collectDayEvents(schedule),
		tasks,
		dateIso: ctx.dateIso,
		tz: ctx.tz,
	});
}
