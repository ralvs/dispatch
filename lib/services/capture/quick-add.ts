import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskCapture } from "@/lib/ai/parser";
import { loadCaptureContext, taskInputFromAction } from "@/lib/services/capture/resolve";
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
	const { routing, ctx } = await loadCaptureContext(sb);
	const parsed = await parseTaskCapture(text, ctx);

	if (!parsed.ok) {
		const task = await createTask(sb, { title: text.trim(), source: "manual" });
		return { task, parsed: false };
	}

	const task = await createTask(sb, taskInputFromAction(parsed.task, routing));
	return { task, parsed: true };
}
