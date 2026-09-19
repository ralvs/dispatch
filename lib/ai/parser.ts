import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { isAiConfigured, parserModel } from "@/lib/ai/gateway";
import { guardTitle } from "@/lib/ai/verbatim";
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
// Shared with the sentence → task module (lib/services/capture/quick-add.ts).
// The two prompts are NOT variants of one another — systemPrompt asks for an
// array of mixed actions, the task prompt for a single task or null — so only
// the copy they genuinely share lives here.

// The task field formats. Indentation is the caller's, since systemPrompt
// nests this under its create_task bullet and the task prompt does not.
export const TASK_FIELD_FORMATS =
	"priority is 1 (high), 2 (medium) or 3 (low). due_date is YYYY-MM-DD, due_time is HH:mm.";

// Relative dates resolve against the app timezone, never the model's guess at
// "now" (iron rule #1) — both prompts state it identically.
export function dateResolution(ctx: ParseContext): string[] {
	return [
		// Whole seconds: the model gains nothing from milliseconds, and a
		// changing millisecond makes every prompt unique.
		`Resolve relative dates against NOW=${ctx.nowUtc.replace(/\.\d+Z$/, "Z")}, TODAY=${ctx.todayIso},`,
		`timezone ${ctx.tz}. Output due_date as YYYY-MM-DD and due_time as HH:mm.`,
		// "Resolve relative dates" alone was not an instruction the model could
		// act on: measured against the gateway, a small parser model dropped
		// "today" from "home: Ask refunds today" in 15 out of 15 runs, and
		// "sexta" in 3 out of 3 — the word simply vanished, landing in neither
		// the title nor due_date. Naming the words and demanding the field is
		// what makes a day word turn into a date.
		"ANY word naming a day is a due_date — never drop it and never leave it",
		"in the title. today/tonight/hoje → TODAY. tomorrow/amanhã → TODAY+1.",
		"A weekday name (Monday, segunda, sexta, …) → the NEXT such weekday,",
		"counting today only if the utterance says so. next week/semana que vem",
		"→ TODAY+7. A bare day number (the 5th, dia 5) → that day of the current",
		"month, or the next month if it has already passed.",
		"If you cannot resolve a day word to a date, keep it in the title rather",
		"than discarding it.",
	];
}

export function recurrenceRules(): string[] {
	return [
		"  recurrence_rule is set ONLY when the user states repetition (e.g.",
		'  "every Monday", "toda segunda", "daily", "todo dia"). Pick the closest',
		"  match from: daily, weekdays, weekly, biweekly, monthly, semiannually,",
		'  yearly. "every Monday" → weekly, with due_date set to the next Monday.',
		"  For repetition on SEVERAL named weekdays, use weekly:<codes> with the",
		'  two-letter codes su,mo,tu,we,th,fr,sa — e.g. "every Tuesday and',
		'  Saturday" → weekly:tu,sa, "terça e sábado" → weekly:tu,sa. Use it only',
		'  for named weekdays: it cannot say an interval ("every other Tuesday")',
		'  or a position ("last Friday of the month").',
		'  If the cadence has no match at all (e.g. "every 3 weeks"), OMIT',
		"  recurrence_rule and keep the phrase in notes instead of guessing.",
		"  notes carries secondary detail verbatim (never the title).",
	];
}

export function routingBlock(ctx: ParseContext): string[] {
	const domains = ctx.domains ?? [];
	const projects = ctx.projects ?? [];
	if (domains.length === 0 && projects.length === 0) return [];
	const lines = ["", "Routing a task to a domain or project:"];
	if (domains.length > 0) lines.push(`KNOWN DOMAINS: ${domains.join(", ")}`);
	if (projects.length > 0) lines.push(`KNOWN PROJECTS: ${projects.join(", ")}`);
	lines.push(
		"Set domain/project ONLY when the utterance actually says that name; copy",
		"it EXACTLY as listed above. No clear match → OMIT, never guess.",
		// This used to read "domain and project are INDEPENDENT", which was
		// false about the data and is now false about the app: every project
		// belongs to a domain, the task form settles one from the other, and
		// resolveTaskRouting drops a contradicting domain. Saying otherwise
		// invited the model to emit a pair that then had to be repaired.
		"A project already belongs to a domain, so naming a project is enough —",
		"do not also name a domain for it. Name a domain on its own only when no",
		"project was spoken. If both are named and they disagree, keep the",
		"project and leave the domain out.",
		"Naming a domain is never a reason to fill project: if no project from",
		"the list was spoken, leave project out. Never echo the domain into",
		"project, never copy a word out of the task into it, and never pick a",
		"list entry that was not said.",
		// Omission had to be spelled out as a mechanical rule. Told only to
		// "omit", the measured failure was not a wrong guess but a placeholder:
		// the model answered project as "", ":" or "," in 8 of 9 runs where no
		// project was spoken. An empty string is not an omission, and saying so
		// is cheaper than repairing it downstream.
		// The literal words here matter. An earlier draft said "to OMIT a field"
		// in capitals, and the model started answering `project: "#OMIT#"` —
		// reading the instruction's own keyword as the value to write. State
		// the mechanism, never a token that could be mistaken for one.
		"A field you have no answer for must be ABSENT from the JSON object —",
		"do not include its key at all. Never write a stand-in value such as",
		'"", " ", ":", "none", "null" or a word from these instructions. Any',
		"string you write will be treated as a real answer.",
		"Dictated text has no punctuation, so a destination is often just the",
		'first word with no separator — "saúde marcar dentista" names Health and',
		'the title is "marcar dentista". Only strip that word when it is a',
		"destination; when it belongs to the sentence, keep it and omit routing.",
	);
	return lines;
}

// Shared generateObject budget. Default retries (2) can triple a schema miss;
// a runaway object should not sit until the function times out.
//
// The abort signal is the budget for the WHOLE call — every attempt plus the
// backoff delay between them — not per attempt. Measured against the gateway,
// one parse of a short utterance runs ~1.5s at best but 6s at the median and
// 19s at the tail, so the old 8s cap failed roughly 4 calls in 10 and turned a
// perfectly parseable "check X tomorrow" into a needs_review note. 30s holds
// the tail plus one retry, and the palette never blocks on it: the UI shows a
// provisional receipt immediately and settles when the pipeline returns.
const PARSE_MAX_RETRIES = 1;
const PARSE_MAX_OUTPUT_TOKENS = 400;
const PARSE_TIMEOUT_MS = 30_000;

/**
 * Why a parse degraded. The catch below is the ONLY place the cause exists —
 * the caller sees a typed "failed" and nothing more — so without this line a
 * needs_review note is undiagnosable after the fact. Logs the shape of the
 * error, never the user's text.
 */
export function logParseFailure(where: string, error: unknown): void {
	const e = error as { name?: string; message?: string };
	console.warn("parse failed", { where, name: e?.name, message: e?.message });
}

export function parseCallOptions() {
	return {
		maxRetries: PARSE_MAX_RETRIES,
		maxOutputTokens: PARSE_MAX_OUTPUT_TOKENS,
		abortSignal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
	};
}

export function captureSystemPrompt(ctx: ParseContext): string {
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

/**
 * Applies the verbatim guard to the one field it can protect on each action:
 * the line the user will actually read in a list. `create_note`,
 * `create_quote` and `create_journal_entry` are exempt — their body IS the
 * utterance, copied whole, so a guard there would only ever compare the text
 * to itself.
 */
function guardActionTitle(action: CaptureAction, text: string): CaptureAction {
	if (action.action !== "create_task" && action.action !== "create_event") return action;
	const { title, substituted } = guardTitle(action.title, text);
	if (substituted) console.warn("parse title not verbatim", { action: action.action });
	return { ...action, title };
}

export async function parse(text: string, ctx: ParseContext): Promise<ParseResult> {
	try {
		// Config lookup is INSIDE the try: env() is lazily validated and can throw,
		// and parserModel() reads it too. A config failure degrades, never escapes.
		if (!isAiConfigured()) return { ok: false, reason: "unavailable", raw: text };

		const system = captureSystemPrompt(ctx);
		const { object } = await generateObject({
			model: parserModel(),
			schema: z.object({ actions: CaptureActionsSchema }),
			system,
			prompt: text,
			...parseCallOptions(),
		});
		if (object.actions.length === 0) return { ok: false, reason: "empty", raw: text };
		return { ok: true, actions: object.actions.map((a) => guardActionTitle(a, text)) };
	} catch (error) {
		// Model error OR output that failed CaptureActionsSchema (unknown verb,
		// malformed action). Degrade — the raw text is never lost.
		logParseFailure("parse", error);
		return { ok: false, reason: "failed", raw: text };
	}
}
