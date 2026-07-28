import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseTaskCapture } from "@/lib/ai/parser";
import { buildMentionIndex, extractMentions } from "@/lib/mentions";
import { loadCaptureContext, taskInputFromAction } from "@/lib/services/capture/resolve";
import { syncMentions } from "@/lib/services/mentions";
import { listMentionCandidates } from "@/lib/services/people";
import { createTask, type TaskRow } from "@/lib/services/tasks";

/**
 * Best-effort @mention sync for a just-created task (docs/adr/0030 D4). Never
 * allowed to fail the capture (iron rule #4) — a mention that fails to
 * resolve or sync is a missing link, not a lost task, so every failure here
 * is swallowed rather than rethrown.
 */
async function syncTaskMentionsBestEffort(
	sb: SupabaseClient,
	taskId: string,
	title: string,
	notes: string | null | undefined,
) {
	try {
		const candidates = await listMentionCandidates(sb);
		const index = buildMentionIndex(candidates);
		const matches = extractMentions(`${title}\n${notes ?? ""}`, index);
		await syncMentions(sb, { type: "task", id: taskId }, matches);
	} catch {
		// Swallowed on purpose — never lose a capture over a mention sync.
	}
}

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
		await syncTaskMentionsBestEffort(sb, task.id, task.title, task.notes);
		return { task, parsed: false };
	}

	const task = await createTask(sb, taskInputFromAction(parsed.task, routing));
	await syncTaskMentionsBestEffort(sb, task.id, task.title, task.notes);
	return { task, parsed: true };
}
