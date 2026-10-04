import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type ParserModel, parseTask } from "@/lib/ai/parser";
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

/**
 * `domainId` is a domain the operator PICKED on the form, not one the parser
 * inferred. The task dialog sends it because its domain field is mandatory now
 * while its sentence parsing is not, so a create can legitimately be both "read
 * this sentence" and "file it here". A stated answer beats an inferred one, so
 * it overrides whatever the parse resolved — including on the degraded path,
 * where there is no parse at all and it is the only filing there is.
 *
 * `model` is the parser's (lib/ai/parser.ts ParseOptions): left out in the
 * app, injected by tests.
 */
export async function quickAddTask(
	sb: SupabaseClient,
	text: string,
	options: { domainId?: string | null; model?: ParserModel | null } = {},
): Promise<{ task: TaskRow; parsed: boolean }> {
	const stated = options.domainId || null;
	const { routing, ctx } = await loadCaptureContext(sb);
	const parsed = await parseTask(text, ctx, { model: options.model });

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
 * it. Dropping it is not optional: the database files a task in its project's
 * domain (docs/adr/0072), so a kept project would overrule the stated domain.
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
