import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { isAiConfigured, parserModel } from "@/lib/ai/gateway";
import { type CaptureAction, CaptureActionsSchema } from "@/lib/schemas/capture";

// ─────────────────────────────────────────────────────────────────────────
// Text -> actions seam. Turns one capture text into v1 capture actions via the
// gateway (generateObject, schema-validated). Never throws into the capture
// path: every failure mode returns a typed fallback the orchestrator degrades.
//
//   unavailable  AI_GATEWAY_API_KEY unset (isAiConfigured() false)
//   failed       the model call threw, or its output failed CaptureActionsSchema
//                (including any unknown/unsupported verb) — degrade, never crash
//   empty        parser ran cleanly but found nothing actionable — the raw text
//                is preserved as a plain note by the orchestrator
// ─────────────────────────────────────────────────────────────────────────

export type ParseContext = {
	tz: string;
	todayIso: string;
	nowUtc: string;
};

export type ParseResult =
	| { ok: true; actions: CaptureAction[] }
	| { ok: false; reason: "unavailable" | "failed" | "empty"; raw: string };

function systemPrompt(ctx: ParseContext): string {
	return [
		"You convert ONE spoken or typed utterance into a JSON array of actions.",
		"Allowed actions ONLY:",
		"- create_task { title, due_date?, due_time?, priority? } — something to do.",
		"  priority is 1 (highest) to 4. due_date is YYYY-MM-DD, due_time is HH:mm.",
		"- create_note { body, source_type?, tags? } — a thought, observation, or",
		"  anything to remember that is not itself a task.",
		"- create_quote { text, source_type?, source_author?, tags? } — a quotation",
		"  the user is saving from something they read/heard. Copy text verbatim.",
		"- create_journal_entry { body, entry_date?, tags? } — a diary/journal entry",
		"  the user is recording about their day. Copy body verbatim. entry_date is",
		"  YYYY-MM-DD (default today).",
		"- needs_review { reason, proposed_kind? } — use this INSTEAD of guessing",
		"  when the utterance references an entity you cannot resolve (a specific",
		"  project, person, or quote). Set proposed_kind to the action you would",
		"  have taken (e.g. create_project) and reason to a short explanation.",
		"If nothing is actionable, use an empty actions array.",
		"",
		"Language: the user speaks Portuguese (pt-BR) or English. Detect it, and",
		"NEVER translate. Copy every free-text field (title, body, reason) verbatim",
		"in the language spoken.",
		"",
		`Resolve relative dates against NOW=${ctx.nowUtc}, TODAY=${ctx.todayIso},`,
		`timezone ${ctx.tz}. Output due_date as YYYY-MM-DD and due_time as HH:mm.`,
		'Return a JSON object of the form {"actions": [ ...actions... ]}.',
	].join("\n");
}

export async function parse(text: string, ctx: ParseContext): Promise<ParseResult> {
	try {
		// Config lookup is INSIDE the try: env() is lazily validated and can throw,
		// and parserModel() reads it too. A config failure degrades, never escapes.
		if (!isAiConfigured()) return { ok: false, reason: "unavailable", raw: text };

		const { object } = await generateObject({
			model: parserModel(),
			schema: z.object({ actions: CaptureActionsSchema }),
			system: systemPrompt(ctx),
			prompt: text,
		});
		if (object.actions.length === 0) return { ok: false, reason: "empty", raw: text };
		return { ok: true, actions: object.actions };
	} catch {
		// Model error OR output that failed CaptureActionsSchema (unknown verb,
		// malformed action). Degrade — the raw text is never lost.
		return { ok: false, reason: "failed", raw: text };
	}
}
