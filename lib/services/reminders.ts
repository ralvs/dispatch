import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shiftDay } from "@/lib/dates";
import {
	planReminders,
	type ReminderCandidate,
	type ReminderPlanEntry,
	reminderMessage,
} from "@/lib/reminders";
import { unwrap } from "@/lib/services/errors";
import { recordNotification } from "@/lib/services/notifications";
import { getReminderSettings } from "@/lib/services/settings";

/**
 * Open tasks with a due_date inside the window a reminder tick could act on.
 *
 * Lower bound is `todayIso - 1` ON PURPOSE, not `todayIso`: a task due
 * yesterday 23:00 with a zero offset is still inside the 2h catch-up window
 * when the cron ticks at 00:05 today (its due_date is yesterday, but "now"
 * has already rolled to today). Upper bound of +3 comfortably covers any
 * offset up to REMINDER_CHOICES' max (1 day) plus scheduling slop.
 *
 * Hand-written select (like getTaskHot in lib/services/tasks.ts), not
 * TASK_SELECT — this must not widen TaskRowSchema for a cron-only read.
 */
export async function listReminderCandidates(
	sb: SupabaseClient,
	todayIso: string,
): Promise<ReminderCandidate[]> {
	const data = unwrap(
		await sb
			.from("tasks")
			.select("id, title, due_date, due_time, reminders_sent")
			.eq("status", "open")
			.gte("due_date", shiftDay(todayIso, -1))
			.lte("due_date", shiftDay(todayIso, 3)),
	);
	return (data ?? []) as unknown as ReminderCandidate[];
}

export async function markRemindersSent(
	sb: SupabaseClient,
	taskId: string,
	sent: { due: string },
): Promise<void> {
	unwrap(await sb.from("tasks").update({ reminders_sent: sent }).eq("id", taskId));
}

async function deliver(
	sb: SupabaseClient,
	entry: ReminderPlanEntry,
	offsetMinutes: number,
): Promise<void> {
	const message = reminderMessage({
		title: entry.title,
		dueDate: entry.dueDate,
		dueTime: entry.dueTime,
		offsetMinutes,
	});
	// Notify THEN mark sent (ADR-0015 ordering: duplicate over loss). One
	// ledger row per DELIVERED reminder — no summary row, since these rows
	// already are the ledger under iron rule #6 and a summary would double
	// count.
	await recordNotification(sb, {
		type: "reminder.fired",
		title: message.title,
		body: message.body,
		source_ref: entry.taskId,
		source_url: `/tasks?edit=${entry.taskId}`,
	});
	await markRemindersSent(sb, entry.taskId, { due: entry.dueDate });
}

export async function runTaskReminders(
	sb: SupabaseClient,
	input: { tz: string; todayIso: string; nowMs?: number },
): Promise<{ scanned: number; fired: number; suppressed: number }> {
	const [tasks, { offsetMinutes, anchorTime }] = await Promise.all([
		listReminderCandidates(sb, input.todayIso),
		getReminderSettings(sb),
	]);

	const plan = planReminders({
		tasks,
		tz: input.tz,
		todayIso: input.todayIso,
		nowMs: input.nowMs ?? Date.now(),
		offsetMinutes,
		anchorTime,
	});

	for (const entry of plan.fire) {
		await deliver(sb, entry, offsetMinutes);
	}
	for (const entry of plan.suppress) {
		// Mark only — beyond catch-up, no notification.
		await markRemindersSent(sb, entry.taskId, { due: entry.dueDate });
	}

	return { scanned: tasks.length, fired: plan.fire.length, suppressed: plan.suppress.length };
}
