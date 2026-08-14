import type { DayScheduleItem } from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/schemas/task";

/**
 * Canonical "what the day cares about on screen" for a task row.
 * daySignature serializes this projection only — add a field here when
 * task-row chrome starts showing it.
 */
export function visibleTaskFields(task: TaskRow) {
	return {
		id: task.id,
		status: task.status,
		title: task.title,
		top3_for_date: task.top3_for_date,
		priority: task.priority,
		domainId: task.domain?.id ?? null,
		domainName: task.domain?.name ?? null,
		domainColor: task.domain?.color ?? null,
		projectName: task.project?.name ?? null,
		due_date: task.due_date,
		due_time: task.due_time,
		recurrence_rule: task.recurrence_rule,
	};
}

/** On-screen fields for a timed/all-day event on the day schedule. */
export function visibleEventFields(event: DayScheduleItem & { kind: "event" }) {
	return {
		id: event.event.id,
		title: event.event.title,
		end_at: event.event.end_at,
		calendar_name: event.event.calendar_name,
		location: event.event.location,
	};
}
