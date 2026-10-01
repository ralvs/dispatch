// Shared fixtures for the store's tests. Not imported by app code.
import type { DaySchedulePayload } from "@/lib/day-schedule";
import type { NotificationRow } from "@/lib/schemas/notification";
import type { TaskRow } from "@/lib/schemas/task";
import type { Snapshot, ViewSeed } from "@/lib/store/types";

export const TZ = "America/Sao_Paulo";
export const TODAY = "2026-07-15";

/** Instants in order: T0 < T1 < … */
export const T0 = "2026-07-15T12:00:00.000Z";
export const T1 = "2026-07-15T12:01:00.000Z";
export const T2 = "2026-07-15T12:02:00.000Z";
export const T3 = "2026-07-15T12:03:00.000Z";
export const T4 = "2026-07-15T12:04:00.000Z";
export const NOW = "2026-07-15T12:02:30.000Z";

export function task(partial: Partial<TaskRow> & Pick<TaskRow, "id">): TaskRow {
	return {
		title: partial.id,
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 3,
		project_id: null,
		domain_id: "domain-1",
		recurrence_rule: null,
		recurrence_day: null,
		top3_for_date: null,
		source: "manual",
		created_at: "2026-07-01T12:00:00.000Z",
		completed_at: null,
		domain: null,
		project: null,
		...partial,
	};
}

export function notification(
	partial: Partial<NotificationRow> & Pick<NotificationRow, "id">,
): NotificationRow {
	return {
		type: "reminder.fired",
		title: partial.id,
		body: null,
		source_ref: null,
		source_url: null,
		status: "unread",
		undo_payload: null,
		created_at: "2026-07-15T11:00:00.000Z",
		...partial,
	};
}

export function dayPayload(dateIso: string, tasks: TaskRow[] = []): DaySchedulePayload {
	return {
		schedule: { allDay: [], timeline: [], top3: [], open: tasks },
		dateIso,
		nowUtcIso: T0,
		nowLabel: null,
		eventNoteIds: {},
		taskNoteIds: {},
	};
}

export function snapshot(
	readAt: string,
	views: ViewSeed[] = [],
	extra: Partial<Snapshot> = {},
): Snapshot {
	return { readAt, todayIso: TODAY, tz: TZ, views, ...extra };
}

/** Recursively freeze, so a transition that mutates its input throws. */
export function deepFreeze<T>(value: T): T {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const v of Object.values(value)) deepFreeze(v);
	}
	return value;
}
