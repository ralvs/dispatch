import "server-only";
import { generateObject, type SystemModelMessage } from "ai";
import { z } from "zod";
import { isAiConfigured, MODEL_PROVIDER_OPTIONS, parserModel } from "@/lib/ai/gateway";
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
	// Known routing destinations, sent so the model can name one instead of
	// guessing (docs/adr/0019 D1/D2). Each project carries its domain's name,
	// so the model can see which domain a project already settles. Names only,
	// never ids: routing matches by name, and an id is one more thing to invent.
	domains?: string[];
	projects?: { name: string; domain?: string }[];
};

export type ParseResult =
	| { ok: true; actions: CaptureAction[] }
	| { ok: false; reason: "unavailable" | "failed" | "empty"; raw: string };

// ── Shared prompt fragments ────────────────────────────────────────────
//
// Shared with the sentence → task module (lib/services/capture/quick-add.ts).
// The two prompts are NOT variants of one another — captureSystemPrompt asks for an
// array of mixed actions, the task prompt for a single task or null — so only
// the copy they genuinely share lives here.

// The task field formats. Indentation is the caller's, since captureSystemPrompt
// nests this under its create_task bullet and the task prompt does not.
export const TASK_FIELD_FORMATS =
	"priority is 1 (high), 2 (medium) or 3 (low). due_date is YYYY-MM-DD, due_time is HH:mm.";

/** Who the prompt is for. Jerad's prompt opens this way; it costs one line. */
export const PERSONA =
	"You are the capture parser for Dispatch, Renan's personal operations dashboard.";

// Priority is set only on a spoken signal. With no signal the key stays out
// and the database default (3, low) applies — so a plain "buy milk" is never
// promoted, which is the reference's rule mapped onto three levels.
export function priorityRules(): string[] {
	return [
		"  priority is set ONLY when the user signals it: urgent, asap, important,",
		"  high priority, urgente, importante, prioridade alta → 1. medium",
		"  priority, média prioridade → 2. low priority, baixa prioridade → 3.",
		"  No signal → leave priority out. The signal word is not part of the title.",
	];
}

// The reference strips filler from titles. Dispatch keeps the verbatim guard
// (lib/ai/verbatim.ts), which rejects a title with any word the user did not
// say — so dropping words is safe here, and rewording is not.
export function titleRules(): string[] {
	return [
		"  title is the task in the user's own words, under 100 characters. Leave",
		"  out hesitations and lead-ins that are not the task: uh, um, like, so, I",
		"  need to, remind me to, don't forget to, preciso, tenho que, lembrar de,",
		"  não esquecer de. Never reword, reorder or add a word.",
	];
}

// Relative dates resolve against the app timezone, never the model's guess at
// "now" (iron rule #1) — both prompts state it identically. The values
// themselves arrive per call in <context> (captureUserMessage); only the rule
// lives here, so the system prompt never changes between calls.
export function dateResolution(): string[] {
	return [
		"Resolve relative dates against now, today and timezone in <context>.",
		"Output due_date as YYYY-MM-DD and due_time as HH:mm.",
		// "Resolve relative dates" alone was not an instruction the model could
		// act on: measured against the gateway, a small parser model dropped
		// "today" from "home: Ask refunds today" in 15 out of 15 runs, and
		// "sexta" in 3 out of 3 — the word simply vanished, landing in neither
		// the title nor due_date. Naming the words and demanding the field is
		// what makes a day word turn into a date.
		"ANY word naming a day is a due_date — never drop it and never leave it",
		"in the title. today/tonight/hoje → today. tomorrow/amanhã → today+1.",
		"A weekday name (Monday, segunda, sexta, …) → the NEXT such weekday,",
		"counting today only if the utterance says so. next week/semana que vem",
		"→ today+7. A bare day number (the 5th, dia 5) → that day of the current",
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

// The rules only. The lists they apply to arrive per call in <context>, so the
// system prompt is byte-identical from call to call — which is what lets it be
// cached (docs/adr/0061). An empty list is simply absent from <context>.
export function routingBlock(): string[] {
	return [
		"",
		"Routing a task to a domain or project:",
		"<context> lists the known domains, and the known projects with the",
		"domain each belongs to. With no list there, never set domain or project.",
		"Set domain/project ONLY when the utterance actually names one. Write the",
		"name as listed in <context> when you can tell which one it is; otherwise",
		'write the short phrase the user said for it ("the apartment") and the app',
		"finds the closest name. Never write a phrase the user did not say. No",
		"clear match → OMIT, never guess.",
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
	];
}

/**
 * A system prompt marked for Anthropic prompt caching. The mark ends the
 * cached prefix, so everything before it must be static — captureUserMessage
 * is where the per-call data goes.
 *
 * Opus 5 caches only a prefix of 512 tokens or more, silently; both parser
 * prompts are above that. The cache lives 5 minutes: a write costs 1.25× the
 * input price and a read 0.1×, so it pays when two captures land close
 * together, and it cuts latency on a hit. Whether a call hit shows as
 * usage.inputTokenDetails.cacheReadTokens (the eval prints it).
 */
export function cachedSystem(content: string): SystemModelMessage {
	return {
		role: "system",
		content,
		providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
	};
}

/**
 * The per-call half of the request: everything that changes between captures,
 * followed by the utterance itself. It goes in the user message, AFTER the
 * system prompt, because prompt caching matches the start of a request byte for
 * byte — one changing line near the top of the system prompt (the clock, or a
 * renamed project) used to make every request unique.
 *
 * The tags also separate the two halves for the model: <context> is data about
 * the app, and only <utterance> is something the user said.
 */
export function captureUserMessage(text: string, ctx: ParseContext): string {
	const context: Record<string, unknown> = {
		// Whole seconds: the model gains nothing from milliseconds.
		now: ctx.nowUtc.replace(/\.\d+Z$/, "Z"),
		today: ctx.todayIso,
		timezone: ctx.tz,
	};
	if (ctx.domains && ctx.domains.length > 0) context.domains = ctx.domains;
	if (ctx.projects && ctx.projects.length > 0) context.projects = ctx.projects;
	return [
		"<context>",
		JSON.stringify(context, null, 2),
		"</context>",
		"",
		"<utterance>",
		text,
		"</utterance>",
	].join("\n");
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
		providerOptions: MODEL_PROVIDER_OPTIONS,
	};
}

// Worked examples. The day-word fix showed that named cases move the model
// where abstract rules do not. They use a made-up world (domain Casa, project
// Kitchen reno, a Thursday) that shares no names with the eval's, so the eval
// still measures the rules rather than recall of an example.
export const EXAMPLE_WORLD =
	'Examples, for a <context> with today 2026-01-15 (a Thursday), domains ["Casa", "Work"] and projects [{"name": "Kitchen reno", "domain": "Casa"}]:';

export function taskExamples(): string[] {
	return [
		'- "casa: fix the faucet tomorrow" → {"title": "fix the faucet", "due_date": "2026-01-16", "domain": "Casa"}',
		'- "order tiles for the kitchen" → {"title": "order tiles", "project": "Kitchen reno"}',
		'- "urgente pagar o DARF sexta" → {"title": "pagar o DARF", "priority": 1, "due_date": "2026-01-16"}',
		'- "uh remind me to water the plants every Sunday" → {"title": "water the plants", "recurrence_rule": "weekly", "due_date": "2026-01-18"}',
		'- "buy stamps" → {"title": "buy stamps"}',
	];
}

export function paletteExamples(): string[] {
	return [
		EXAMPLE_WORLD,
		'- "casa: fix the faucet tomorrow" → [{"action": "create_task", "title": "fix the faucet", "due_date": "2026-01-16", "domain": "Casa"}]',
		'- "order tiles for the kitchen and call the plumber at 3pm" → [{"action": "create_task", "title": "order tiles", "project": "Kitchen reno"}, {"action": "create_event", "title": "call the plumber", "start_date": "2026-01-15", "start_time": "15:00", "end_time": "15:30"}]',
		'- "jantar com a Bia sábado às 20h" → [{"action": "create_event", "title": "jantar com a Bia", "start_date": "2026-01-17", "start_time": "20:00", "end_time": "21:30"}]',
		'- "note to self the kitchen light flickers when the fan is on" → [{"action": "create_note", "body": "the kitchen light flickers when the fan is on", "source_type": "observation"}]',
		'- "quote from Seneca: we suffer more in imagination than in reality" → [{"action": "create_quote", "text": "we suffer more in imagination than in reality", "source_author": "Seneca"}]',
		'- "journal: long day, but the demo went well" → [{"action": "create_journal_entry", "body": "long day, but the demo went well"}]',
		'- "add to the Seneca quote that this is about anxiety" → [{"action": "needs_review", "reason": "refers to a saved quote", "proposed_kind": "create_quote_annotation"}]',
		'- "ok" → []',
	];
}

export function captureSystemPrompt(): string {
	return [
		PERSONA,
		"You convert ONE spoken or typed utterance into a JSON array of actions.",
		"The user message holds <context> (app data: the date, the known domains",
		"and projects) and then <utterance>, the only thing the user said.",
		"Allowed actions ONLY:",
		"- create_task { title, notes?, due_date?, due_time?, priority?,",
		"  recurrence_rule?, domain?, project? } — something to do.",
		`  ${TASK_FIELD_FORMATS}`,
		...titleRules(),
		...priorityRules(),
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
		"Choosing between note, quote and journal entry:",
		"- create_quote: the user saves SOMEONE ELSE's words. Signals: save a",
		'  quote, quote from <book/author>, quotation marks, an attribution ("—',
		'  Author", "as X said"). text is the quoted words only; source_author is',
		"  the person named.",
		"- create_journal_entry: the user records THEIR OWN day. Signals: journal,",
		'  diário, journal entry, log for today, or "today I…"/"hoje eu…" telling',
		'  what happened or how it felt. "today I need to…" is a task, not a',
		"  journal entry.",
		"- create_note: anything else worth remembering: an idea, note to self, a",
		'  thought after reading ("I was reading…" → source_type reading_response)',
		"  or after a meeting (meeting_note). The safe default when it is not a",
		"  task, event, quote or journal entry.",
		"",
		...paletteExamples(),
		"",
		"Language: the user speaks Portuguese (pt-BR) or English. Detect it, and",
		"NEVER translate. Copy every free-text field (title, body, reason) verbatim",
		"in the language spoken.",
		"",
		...dateResolution(),
		...routingBlock(),
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

		const { object } = await generateObject({
			model: parserModel(),
			schema: z.object({ actions: CaptureActionsSchema }),
			system: cachedSystem(captureSystemPrompt()),
			prompt: captureUserMessage(text, ctx),
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
