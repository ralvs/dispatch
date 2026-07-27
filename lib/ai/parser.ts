import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { isAiConfigured, parserModel } from "@/lib/ai/gateway";
import {
	type CaptureAction,
	CaptureActionsSchema,
	type CreateTaskAction,
	CreateTaskActionSchema,
} from "@/lib/schemas/capture";

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
	// Known routing destinations, injected so the model can name one instead of
	// guessing (docs/adr/0019 D1/D2). Omitted or empty → routing block skipped.
	domains?: string[];
	projects?: string[];
};

export type ParseResult =
	| { ok: true; actions: CaptureAction[] }
	| { ok: false; reason: "unavailable" | "failed" | "empty"; raw: string };

// ── Shared prompt fragments ────────────────────────────────────────────
//
// The two prompts below are NOT variants of one another — systemPrompt asks
// for an array of mixed actions, taskCaptureSystemPrompt for a single task or
// null — so only the copy they genuinely share lives here. Anything a change
// to one prompt should not silently make to the other stays inline.

// The task field formats. Indentation is the caller's, since systemPrompt
// nests this under its create_task bullet and taskCaptureSystemPrompt does not.
const TASK_FIELD_FORMATS =
	"priority is 1 (highest) to 4. due_date is YYYY-MM-DD, due_time is HH:mm.";

// Relative dates resolve against the app timezone, never the model's guess at
// "now" (iron rule #1) — both prompts state it identically.
function dateResolution(ctx: ParseContext): string[] {
	return [
		`Resolve relative dates against NOW=${ctx.nowUtc}, TODAY=${ctx.todayIso},`,
		`timezone ${ctx.tz}. Output due_date as YYYY-MM-DD and due_time as HH:mm.`,
	];
}

function recurrenceRules(): string[] {
	return [
		"  recurrence_rule is set ONLY when the user states repetition (e.g.",
		'  "every Monday", "toda segunda", "daily", "todo dia"). Pick the closest',
		"  match from: daily, weekdays, weekly, biweekly, monthly, semiannually,",
		'  yearly. "every Monday" → weekly, with due_date set to the next Monday.',
		'  If the cadence has no match in that list (e.g. "every 3 weeks"), OMIT',
		"  recurrence_rule and keep the phrase in notes instead of guessing.",
		"  notes carries secondary detail verbatim (never the title).",
	];
}

function routingBlock(ctx: ParseContext): string[] {
	const domains = ctx.domains ?? [];
	const projects = ctx.projects ?? [];
	if (domains.length === 0 && projects.length === 0) return [];
	const lines = ["", "Routing a task to a domain or project:"];
	if (domains.length > 0) lines.push(`KNOWN DOMAINS: ${domains.join(", ")}`);
	if (projects.length > 0) lines.push(`KNOWN PROJECTS: ${projects.join(", ")}`);
	lines.push(
		"Set domain/project ONLY when the user explicitly names one; copy the",
		"name EXACTLY as listed above. No clear match → OMIT, never guess.",
	);
	return lines;
}

function systemPrompt(ctx: ParseContext): string {
	return [
		"You convert ONE spoken or typed utterance into a JSON array of actions.",
		"Allowed actions ONLY:",
		"- create_task { title, notes?, due_date?, due_time?, priority?,",
		"  recurrence_rule?, domain?, project? } — something to do.",
		`  ${TASK_FIELD_FORMATS}`,
		...recurrenceRules(),
		"- create_event { title, start_date, start_time, end_date?, end_time,",
		"  location?, description? } — something happening AT a time, with other",
		"  people or in a place: a meeting, a call, lunch, a flight, an",
		"  appointment. Prefer create_task when the user must DO it and the time",
		"  is only a deadline; prefer create_event when the time IS the thing.",
		"  Dates are YYYY-MM-DD, times HH:mm. end_time is required — infer the",
		"  duration from what the event is (a standup ~15min, a call ~30min,",
		"  lunch ~1h, a flight or a class as stated). Only set end_date when the",
		"  event runs past midnight. Do NOT invent a location that was not said.",
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
		...dateResolution(ctx),
		...routingBlock(ctx),
		"",
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

// ─────────────────────────────────────────────────────────────────────────
// Task-only parse for the /tasks quick-add input (Part B). Same no-throw,
// typed-fallback contract as parse() above, narrowed to a single task.
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

		const { object } = await generateObject({
			model: parserModel(),
			schema: z.object({ task: CreateTaskActionSchema.nullable() }),
			system: taskCaptureSystemPrompt(ctx),
			prompt: text,
		});
		if (!object.task) return { ok: false, reason: "empty", raw: text };
		return { ok: true, task: object.task };
	} catch {
		return { ok: false, reason: "failed", raw: text };
	}
}
