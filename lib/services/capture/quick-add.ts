import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskCapture } from "@/lib/ai/parser";
import { nowUtc, todayInTz } from "@/lib/dates";
import { withUnresolvedNotes } from "@/lib/services/capture/executor";
import { fetchRoutingLists, resolveTaskRouting } from "@/lib/services/capture/resolve";
import { getAppTimezone } from "@/lib/services/settings";
import { createTask, type TaskRow } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// Task-scoped quick-add for /tasks (docs/adr/0019 D3). Deliberately skips
// captured_data — this is a user-initiated, task-only mutation, not the
// firehose capture pipeline (ADR-0008), so there is no notifications row
// (iron rule #6 scoping) and no needs_review degrade path.
//
// Never-lose is deterministic: any parser failure (unavailable/failed/empty)
// creates the task with the raw text as title. Only a `createTask` throw
// surfaces to the caller — same contract as the manual task form.
// ─────────────────────────────────────────────────────────────────────────

export async function quickAddTask(
	sb: SupabaseClient,
	text: string,
): Promise<{ task: TaskRow; parsed: boolean }> {
	const tz = await getAppTimezone(sb);
	const routing = await fetchRoutingLists(sb);
	const parsed = await parseTaskCapture(text, {
		tz,
		todayIso: todayInTz(tz),
		nowUtc: nowUtc(),
		domains: routing.domains.map((d) => d.name),
		projects: routing.projects.map((p) => p.name),
	});

	if (!parsed.ok) {
		const task = await createTask(sb, { title: text.trim(), source: "manual" });
		return { task, parsed: false };
	}

	const result = resolveTaskRouting(parsed.task, routing);
	const notes = withUnresolvedNotes(parsed.task.notes, result.unresolved);

	const task = await createTask(sb, {
		title: parsed.task.title,
		notes,
		due_date: parsed.task.due_date ?? null,
		due_time: parsed.task.due_time ?? null,
		priority: parsed.task.priority,
		domain_id: result.domain_id,
		project_id: result.project_id,
		recurrence_rule: parsed.task.recurrence_rule ?? null,
		source: "manual",
	});
	return { task, parsed: true };
}
