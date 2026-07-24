// Pure reminder-scheduling core (docs/adr/0021) — no Supabase import, no
// "server-only", client-importable like lib/recurrence.ts.
//
// Reminders are configured ONCE GLOBALLY (an offset + an anchor time in
// app_settings), never per task. `tasks.reminder_offsets` is a leftover
// column from an earlier per-task design and is deliberately dead: nothing
// here reads or writes it.

import { instantFromLocal, isWallClockTime, shiftMinutes } from "@/lib/dates";

export const REMINDER_CATCHUP_MINUTES = 120;
export const MAX_REMINDERS_PER_TICK = 20;
export const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440] as const;

/** Human label for a reminder offset, e.g. `30 -> "30 minutes before"`. */
export function formatReminderOffset(minutes: number): string {
	if (minutes === 0) return "At the time";
	if (minutes % 1440 === 0) {
		const days = minutes / 1440;
		return `${days} day${days === 1 ? "" : "s"} before`;
	}
	if (minutes % 60 === 0) {
		const hours = minutes / 60;
		return `${hours} hour${hours === 1 ? "" : "s"} before`;
	}
	return `${minutes} minutes before`;
}

export function reminderMessage(input: {
	title: string;
	dueDate: string;
	dueTime: string | null;
	offsetMinutes: number;
}): { title: string; body: string } {
	// This lands in a push banner, so it has to read like a sentence — the raw
	// due_date and a Postgres time (which can carry a fraction) do not.
	const clock = input.dueTime?.slice(0, 5) ?? null;
	const body = clock
		? input.offsetMinutes === 0
			? `Due now, at ${clock}.`
			: `Due at ${clock} — ${formatReminderOffset(input.offsetMinutes).toLowerCase()}.`
		: input.offsetMinutes === 0
			? "Due today."
			: `Due today — ${formatReminderOffset(input.offsetMinutes).toLowerCase()}.`;
	return { title: `Reminder: ${input.title}`, body };
}

export type ReminderCandidate = {
	id: string;
	title: string;
	due_date: string | null;
	due_time: string | null;
	reminders_sent: unknown; // jsonb — treat defensively, may be malformed/absent
};

export type ReminderPlanEntry = {
	taskId: string;
	title: string;
	fireAtUtc: string;
	dueDate: string;
	dueTime: string | null;
};

export type ReminderPlan = {
	fire: ReminderPlanEntry[];
	suppress: ReminderPlanEntry[];
	// taskId -> the reminders_sent value to persist (keyed on due_date, not
	// offset, so a recurring roll re-arms for free and an offset change never
	// mass-re-fires — see docs/adr/0021).
	sentByTask: Record<string, { due: string }>;
};

/** The due_date this candidate has already fired-or-suppressed a reminder for, or null. */
function sentDue(remindersSent: unknown): string | null {
	if (
		remindersSent &&
		typeof remindersSent === "object" &&
		"due" in remindersSent &&
		typeof (remindersSent as { due: unknown }).due === "string"
	) {
		return (remindersSent as { due: string }).due;
	}
	return null;
}

/**
 * Resolve one candidate's fire instant, or null if it can't/shouldn't fire:
 *   - no due_date -> never fires
 *   - already sent for the SAME due_date -> skip (dedupe)
 *   - due_time present and well-formed -> anchor there
 *   - due_time absent/malformed -> anchor at the global anchorTime
 */
function resolveFireAt(
	task: ReminderCandidate,
	tz: string,
	offsetMinutes: number,
	anchorTime: string,
): { fireAtUtc: string; dueDate: string; dueTime: string | null } | null {
	if (!task.due_date) return null;
	if (sentDue(task.reminders_sent) === task.due_date) return null;

	const time = task.due_time && isWallClockTime(task.due_time) ? task.due_time : anchorTime;
	const dueInstant = instantFromLocal(task.due_date, time, tz);
	const fireAtUtc = shiftMinutes(dueInstant, -offsetMinutes);
	return { fireAtUtc, dueDate: task.due_date, dueTime: task.due_time };
}

export function planReminders(input: {
	tasks: ReminderCandidate[];
	tz: string;
	todayIso: string;
	nowMs: number;
	offsetMinutes: number;
	anchorTime: string;
	catchupMinutes?: number;
	maxPerTick?: number;
}): ReminderPlan {
	const catchupMinutes = input.catchupMinutes ?? REMINDER_CATCHUP_MINUTES;
	const maxPerTick = input.maxPerTick ?? MAX_REMINDERS_PER_TICK;

	const due: Array<{ task: ReminderCandidate; entry: ReminderPlanEntry }> = [];

	for (const task of input.tasks) {
		// One malformed row must never abort the whole tick.
		try {
			const resolved = resolveFireAt(task, input.tz, input.offsetMinutes, input.anchorTime);
			if (!resolved) continue;
			if (Date.parse(resolved.fireAtUtc) > input.nowMs) continue; // not yet due
			due.push({
				task,
				entry: {
					taskId: task.id,
					title: task.title,
					fireAtUtc: resolved.fireAtUtc,
					dueDate: resolved.dueDate,
					dueTime: resolved.dueTime,
				},
			});
		} catch {
			// Malformed due_date/due_time: skip this task, don't touch its state.
		}
	}

	// Oldest fireAt first, so catch-up and the per-tick cap both apply to the
	// most overdue reminders first.
	due.sort((a, b) => Date.parse(a.entry.fireAtUtc) - Date.parse(b.entry.fireAtUtc));

	const fire: ReminderPlanEntry[] = [];
	const suppress: ReminderPlanEntry[] = [];
	const sentByTask: Record<string, { due: string }> = {};
	const catchupCutoffMs = input.nowMs - catchupMinutes * 60_000;

	let fired = 0;
	for (const { entry } of due) {
		const fireAtMs = Date.parse(entry.fireAtUtc);
		if (fireAtMs < catchupCutoffMs) {
			// Beyond catch-up: mark sent WITHOUT delivering. Must write, not skip
			// — otherwise every tick re-evaluates the same stale set forever.
			suppress.push(entry);
			sentByTask[entry.taskId] = { due: entry.dueDate };
			continue;
		}
		if (fired >= maxPerTick) {
			// The remainder simply rolls to the next tick — no marker written.
			continue;
		}
		fire.push(entry);
		sentByTask[entry.taskId] = { due: entry.dueDate };
		fired++;
	}

	return { fire, suppress, sentByTask };
}
