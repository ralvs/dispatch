import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { z } from "zod";
import { isAiConfigured, parserModel } from "@/lib/ai/gateway";
import {
	dateResolution,
	hedge,
	logParseFailure,
	type ParseContext,
	parseCallOptions,
	recurrenceRules,
	routingBlock,
	TASK_FIELD_FORMATS,
} from "@/lib/ai/parser";
import { guardTitle } from "@/lib/ai/verbatim";
import { type CreateTaskAction, CreateTaskActionSchema } from "@/lib/schemas/capture";
import { loadCaptureContext, taskInputFromAction } from "@/lib/services/capture/resolve";
import { createTask, type TaskRow } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// Sentence → task (docs/adr/0019 D3, 0043). Task-scoped: skips captured_data,
// writes no notifications row, never degrades to needs_review. The firehose
// capture() stays a separate orchestration.
//
// Never-lose is deterministic: any parse failure creates the task with the
// raw text as title. Only a createTask throw surfaces — same as the form.
// ─────────────────────────────────────────────────────────────────────────

export type ParseTaskResult =
	| { ok: true; task: CreateTaskAction }
	| { ok: false; reason: "unavailable" | "failed" | "empty"; raw: string };

function taskCaptureSystemPrompt(ctx: ParseContext): string {
	return [
		"You convert ONE spoken or typed utterance into a single task, or null if",
		"the utterance describes nothing actionable.",
		"Output shape: { title, notes?, due_date?, due_time?, priority?,",
		"  recurrence_rule?, domain?, project? }.",
		"title is required — the task itself, verbatim in the language spoken",
		"(pt-BR or English). NEVER translate.",
		TASK_FIELD_FORMATS,
		...recurrenceRules(),
		"",
		...dateResolution(ctx),
		...routingBlock(ctx),
		"",
		'Return a JSON object of the form {"task": { ... }} or {"task": null}.',
	].join("\n");
}

export async function parseTaskCapture(text: string, ctx: ParseContext): Promise<ParseTaskResult> {
	try {
		if (!isAiConfigured()) return { ok: false, reason: "unavailable", raw: text };

		const system = taskCaptureSystemPrompt(ctx);
		const { object } = await hedge((signal) =>
			generateObject({
				model: parserModel(),
				schema: z.object({ task: CreateTaskActionSchema.nullable() }),
				system,
				prompt: text,
				...parseCallOptions(signal),
			}),
		);
		if (!object.task) return { ok: false, reason: "empty", raw: text };
		// Same guard as the firehose parser: a title made of words the user
		// never typed is worse than the raw sentence (lib/ai/verbatim.ts).
		const { title, substituted } = guardTitle(object.task.title, text);
		if (substituted) console.warn("quick-add title not verbatim");
		return { ok: true, task: { ...object.task, title } };
	} catch (error) {
		logParseFailure("quick-add", error);
		return { ok: false, reason: "failed", raw: text };
	}
}

export async function quickAddTask(
	sb: SupabaseClient,
	text: string,
): Promise<{ task: TaskRow; parsed: boolean }> {
	const { routing, ctx } = await loadCaptureContext(sb);
	const parsed = await parseTaskCapture(text, ctx);

	if (!parsed.ok) {
		const task = await createTask(
			sb,
			{ title: text.trim(), source: "manual" },
			{ graphFail: "swallow" },
		);
		return { task, parsed: false };
	}

	const task = await createTask(sb, taskInputFromAction(parsed.task, routing), {
		graphFail: "swallow",
	});
	return { task, parsed: true };
}
