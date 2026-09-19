import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateObject } from "ai";
import { z } from "zod";
import { isAiConfigured, parserModel } from "@/lib/ai/gateway";
import {
	cachedSystem,
	captureUserMessage,
	dateResolution,
	logParseFailure,
	type ParseContext,
	parseCallOptions,
	recurrenceRules,
	routingBlock,
	TASK_FIELD_FORMATS,
} from "@/lib/ai/parser";
import { guardTitle } from "@/lib/ai/verbatim";
import { type CreateTaskAction, CreateTaskActionSchema } from "@/lib/schemas/capture";
import {
	loadCaptureContext,
	type RoutingLists,
	taskInputFromAction,
} from "@/lib/services/capture/resolve";
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

export function taskCaptureSystemPrompt(): string {
	return [
		"You convert ONE spoken or typed utterance into a single task, or null if",
		"the utterance describes nothing actionable.",
		"The user message holds <context> (app data: the date, the known domains",
		"and projects) and then <utterance>, the only thing the user said.",
		"Output shape: { title, notes?, due_date?, due_time?, priority?,",
		"  recurrence_rule?, domain?, project? }.",
		"title is required — the task itself, verbatim in the language spoken",
		"(pt-BR or English). NEVER translate.",
		TASK_FIELD_FORMATS,
		...recurrenceRules(),
		"",
		...dateResolution(),
		...routingBlock(),
		"",
		'Return a JSON object of the form {"task": { ... }} or {"task": null}.',
	].join("\n");
}

export async function parseTaskCapture(text: string, ctx: ParseContext): Promise<ParseTaskResult> {
	try {
		if (!isAiConfigured()) return { ok: false, reason: "unavailable", raw: text };

		const { object } = await generateObject({
			model: parserModel(),
			schema: z.object({ task: CreateTaskActionSchema.nullable() }),
			system: cachedSystem(taskCaptureSystemPrompt()),
			prompt: captureUserMessage(text, ctx),
			...parseCallOptions(),
		});
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

/**
 * `domainId` is a domain the operator PICKED on the form, not one the parser
 * inferred. The task dialog sends it because its domain field is mandatory now
 * while its sentence parsing is not, so a create can legitimately be both "read
 * this sentence" and "file it here". A stated answer beats an inferred one, so
 * it overrides whatever the parse resolved — including on the degraded path,
 * where there is no parse at all and it is the only filing there is.
 */
export async function quickAddTask(
	sb: SupabaseClient,
	text: string,
	options: { domainId?: string | null } = {},
): Promise<{ task: TaskRow; parsed: boolean }> {
	const stated = options.domainId || null;
	const { routing, ctx } = await loadCaptureContext(sb);
	const parsed = await parseTaskCapture(text, ctx);

	if (!parsed.ok) {
		const task = await createTask(
			sb,
			{ title: text.trim(), domain_id: stated, source: "manual" },
			{ graphFail: "swallow" },
		);
		return { task, parsed: false };
	}

	// The utterance is passed so a routing name the user never said is dropped
	// rather than reported as a miss (see resolveTaskRouting).
	const input = taskInputFromAction(parsed.task, routing, text);
	const task = await createTask(sb, withStatedDomain(input, stated, routing), {
		graphFail: "swallow",
	});
	return { task, parsed: true };
}

/**
 * Overrides the parse's domain with the one the operator stated, and drops the
 * parsed project when the two disagree.
 *
 * Dropping it is the whole point. A project already belongs to a domain, so
 * filing a task in project P under some other domain states something the data
 * cannot hold — which is exactly the pairing the task form was just changed to
 * make impossible, and it would have walked straight back in through this
 * path: the form's default create IS title-only, so every such create now
 * arrives with a stated domain, and a sentence naming a project ("add a
 * changelog page to Dispatch") would have kept that project under whatever
 * domain the operator happened to pick.
 *
 * Neither field is silently wrong afterwards: the operator's domain is what
 * they said, and the project falls away rather than dragging the domain with
 * it.
 */
function withStatedDomain(
	input: Parameters<typeof createTask>[1],
	stated: string | null,
	lists: RoutingLists,
): Parameters<typeof createTask>[1] {
	if (!stated) return input;
	const project = lists.projects.find((p) => p.id === input.project_id);
	const conflicts = project != null && project.domain_id !== stated;
	return {
		...input,
		domain_id: stated,
		project_id: conflicts ? null : input.project_id,
	};
}
