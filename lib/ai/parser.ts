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
	"priority is 1 (highest) to 4. due_date is YYYY-MM-DD, due_time is HH:mm.";

// Relative dates resolve against the app timezone, never the model's guess at
// "now" (iron rule #1) — both prompts state it identically.
export function dateResolution(ctx: ParseContext): string[] {
	return [
		`Resolve relative dates against NOW=${ctx.nowUtc}, TODAY=${ctx.todayIso},`,
		`timezone ${ctx.tz}. Output due_date as YYYY-MM-DD and due_time as HH:mm.`,
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
		"domain and project are INDEPENDENT. Naming a domain is not a reason to",
		"fill project: if no project from the list was spoken, omit project",
		"entirely. Never echo the domain into project, never copy a word out of",
		"the task into it, and never pick a list entry that was not said.",
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
	// Promise.any wraps every attempt's rejection in an AggregateError whose own
	// message is just "All promises were rejected" — useless on its own, so
	// report the first real cause underneath it.
	const cause = error instanceof AggregateError ? (error.errors[0] ?? error) : error;
	const e = cause as { name?: string; message?: string };
	console.warn("parse failed", { where, name: e?.name, message: e?.message });
}

export function parseCallOptions(signal?: AbortSignal) {
	return {
		maxRetries: PARSE_MAX_RETRIES,
		maxOutputTokens: PARSE_MAX_OUTPUT_TOKENS,
		abortSignal: signal ?? AbortSignal.timeout(PARSE_TIMEOUT_MS),
	};
}

// How many identical attempts to race. The gateway's latency is dominated by
// queueing variance, not by our prompt: the SAME utterance measured 1.7s at
// best and 21s at worst over 24 runs. Two racing attempts turn that tail into
// the better of two draws — measured p50 5.8s → 2.3s, p90 13.3s → 6.0s, and
// calls over 8s from 10/24 down to 1/24. The cost is one extra ~2.6k-token
// Haiku call per capture (fractions of a cent); the loser is aborted the
// moment the winner resolves. Set to 1 to disable.
const PARSE_HEDGE = 2;

/**
 * Race `PARSE_HEDGE` identical attempts and take the first that SUCCEEDS.
 * Promise.any (not race) is deliberate: a fast schema miss on one attempt must
 * not beat a good answer on the other. Every attempt shares one deadline, so
 * hedging widens the chance of finishing, never the time budget.
 */
export async function hedge<T>(attempt: (signal: AbortSignal) => Promise<T>): Promise<T> {
	const deadline = AbortSignal.timeout(PARSE_TIMEOUT_MS);
	if (PARSE_HEDGE <= 1) return attempt(deadline);

	const loserCutoff = new AbortController();
	const signal = AbortSignal.any([deadline, loserCutoff.signal]);
	try {
		return await Promise.any(Array.from({ length: PARSE_HEDGE }, () => attempt(signal)));
	} finally {
		// The winner has already resolved, so this only stops the losers.
		loserCutoff.abort();
	}
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

		const system = systemPrompt(ctx);
		const { object } = await hedge((signal) =>
			generateObject({
				model: parserModel(),
				schema: z.object({ actions: CaptureActionsSchema }),
				system,
				prompt: text,
				...parseCallOptions(signal),
			}),
		);
		if (object.actions.length === 0) return { ok: false, reason: "empty", raw: text };
		return { ok: true, actions: object.actions };
	} catch (error) {
		// Model error OR output that failed CaptureActionsSchema (unknown verb,
		// malformed action). Degrade — the raw text is never lost.
		logParseFailure("parse", error);
		return { ok: false, reason: "failed", raw: text };
	}
}
