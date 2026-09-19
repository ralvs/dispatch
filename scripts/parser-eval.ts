/**
 * Parser eval — scores the real prompts against the real gateway.
 *
 * The capture parser is the one part of Dispatch whose correctness cannot be
 * unit-tested: its behaviour lives in a model, so a prompt edit that reads like
 * an improvement can silently make things worse, and the only evidence anyone
 * had was "it felt wrong again today". This turns that into a number.
 *
 * Two suites, one per prompt the app sends:
 *   quick-add  one sentence → one task (lib/services/capture/quick-add.ts)
 *   palette    one utterance → any mix of actions (lib/ai/parser.ts)
 *
 * It imports the SAME prompt builders the app uses, so a prompt change is
 * scored the moment it is made — nothing here restates a prompt, which is what
 * would let the eval drift away from production.
 *
 *   bun run eval:parser
 *   bun run eval:parser --runs 5
 *   bun run eval:parser --suite palette
 *   bun run eval:parser --model anthropic/claude-haiku-4.5
 *   bun run eval:parser --effort low
 *
 * Needs AI_GATEWAY_API_KEY, so load the env first:
 *   set -a && . ./.env.local && set +a && bun run eval:parser
 *
 * The script alias carries `--conditions=react-server`, which is what lets a
 * `server-only` module be imported outside Next — without it every file in
 * lib/ai throws on import and the eval cannot reach the prompt it scores.
 *
 * Each case states only the fields it CARES about. A field the case does not
 * mention is not scored, except `project` on a task, which every case scores:
 * inventing a project was the single most common failure, and it is only
 * visible as the absence of something.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { parserModel } from "@/lib/ai/gateway";
import { captureSystemPrompt, captureUserMessage, parseCallOptions } from "@/lib/ai/parser";
import { guardTitle } from "@/lib/ai/verbatim";
import { CaptureActionsSchema, CreateTaskActionSchema } from "@/lib/schemas/capture";
import { taskCaptureSystemPrompt } from "@/lib/services/capture/quick-add";

// A fixed world, so a case's expected date never depends on the day the eval
// runs. TODAY is a Thursday, which makes "sexta"/"Friday" a one-day hop and
// "next Monday" a four-day one — both distinguishable from a lazy TODAY+1.
const TODAY = "2026-09-17";
const TOMORROW = "2026-09-18";
const SATURDAY = "2026-09-19";
const NEXT_MONDAY = "2026-09-21";
const CTX = {
	tz: "America/Sao_Paulo",
	todayIso: TODAY,
	nowUtc: `${TODAY}T14:00:00Z`,
	domains: ["Home", "Work", "Health", "Money", "Learning"],
	projects: [
		{ name: "Dispatch", domain: "Work" },
		{ name: "Apartment move", domain: "Home" },
		{ name: "Taxes 2026", domain: "Money" },
	],
};

/** Field → expected value. `null` means "must be absent". */
type Fields = Record<string, string | null>;
type ExpectedAction = { action: string } & Fields;

type QuickAddCase = { text: string; expect: Fields };
type PaletteCase = { text: string; expect: ExpectedAction[] };

const QUICK_ADD: QuickAddCase[] = [
	// The capture that started this: a domain prefix, a day word, no project.
	{
		text: "home: Ask refunds today",
		expect: { title: "Ask refunds", due_date: TODAY, domain: "Home", project: null },
	},
	{
		text: "work: send the invoice tomorrow at 9",
		expect: {
			title: "send the invoice",
			due_date: TOMORROW,
			due_time: "09:00",
			domain: "Work",
			project: null,
		},
	},
	// Dictated pt-BR: no punctuation, destination is just the first word.
	{
		text: "saúde marcar dentista sexta",
		expect: { title: "marcar dentista", due_date: TOMORROW, domain: "Health", project: null },
	},
	// Nothing to route, nothing to schedule — the case a parser must not embellish.
	{ text: "buy milk", expect: { title: "buy milk", due_date: null, domain: null, project: null } },
	// A project IS named here, so the one thing the other cases forbid is required.
	{
		text: "add a changelog page to Dispatch next week",
		expect: { due_date: "2026-09-24", project: "Dispatch" },
	},
	// A domain word that belongs to the sentence, not to routing.
	{
		text: "write up what working from home costs",
		expect: { domain: null, project: null, due_date: null },
	},
	{ text: "pay the rent every month", expect: { recurrence_rule: "monthly", project: null } },
	{
		text: "gym every Tuesday and Saturday",
		expect: { recurrence_rule: "weekly:tu,sa", project: null },
	},
	// A day word with no other anchor: dropping it is the failure being watched.
	{ text: "call the landlord tonight", expect: { due_date: TODAY, project: null } },

	// ── Harder: added 2026-09-19 to separate models that all scored 100% ──
	// A bare day number that has already passed this month rolls to next month.
	{
		text: "money: pay the credit card on the 5th",
		expect: {
			title: "pay the credit card",
			due_date: "2026-10-05",
			domain: "Money",
			project: null,
		},
	},
	// A deadline that has not passed yet stays in this month.
	{ text: "renew passport before the 30th", expect: { due_date: "2026-09-30", project: null } },
	// pt-BR recurrence with a weekday: the rule AND the first date.
	{
		text: "toda segunda revisar as metas",
		expect: {
			title: "revisar as metas",
			recurrence_rule: "weekly",
			due_date: NEXT_MONDAY,
			project: null,
		},
	},
	// A cadence with no rule must not be forced into the closest one.
	{
		text: "water the plants every other Tuesday",
		expect: { recurrence_rule: null, project: null },
	},
	// A project named mid-sentence, in lower case, with a weekday.
	{
		text: "move the couch for the apartment move saturday",
		expect: { project: "Apartment move", due_date: SATURDAY },
	},
	// pt-BR domain prefix without a colon, plus a day word.
	{
		text: "learning ler o capítulo 3 amanhã",
		expect: { title: "ler o capítulo 3", domain: "Learning", due_date: TOMORROW, project: null },
	},
	// An English day word inside pt-BR must not be translated, and neither
	// must the title.
	{
		text: "pagar IPVA amanhã",
		expect: { title: "pagar IPVA", due_date: TOMORROW, project: null },
	},
];

const PALETTE: PaletteCase[] = [
	// Task vs event: the time is only a deadline here.
	{
		text: "pay the electricity bill by Friday",
		expect: [{ action: "create_task", due_date: TOMORROW, project: null }],
	},
	// …and here the time IS the thing, with a duration the model must infer.
	{
		text: "lunch with Ana tomorrow at 12:30",
		expect: [
			{ action: "create_event", start_date: TOMORROW, start_time: "12:30", end_time: "13:30" },
		],
	},
	{
		text: "dentist appointment next Monday at 3pm",
		expect: [{ action: "create_event", start_date: NEXT_MONDAY, start_time: "15:00" }],
	},
	// Two tasks in one breath.
	{
		text: "buy milk and call mom tonight",
		expect: [
			{ action: "create_task", title: "buy milk", project: null },
			{ action: "create_task", title: "call mom", due_date: TODAY, project: null },
		],
	},
	{
		text: "comprar pão e pagar o condomínio segunda",
		expect: [
			{ action: "create_task", title: "comprar pão", project: null },
			{ action: "create_task", title: "pagar o condomínio", due_date: NEXT_MONDAY, project: null },
		],
	},
	// Routing works in the palette too.
	{
		text: "Taxes 2026: send the receipts to the accountant",
		expect: [{ action: "create_task", project: "Taxes 2026" }],
	},
	// A thought, not a task.
	{
		text: "idea: a weekly review screen that shows what slipped",
		expect: [{ action: "create_note" }],
	},
	{
		text: '"The obstacle is the way" — Marcus Aurelius',
		expect: [
			{ action: "create_quote", text: "The obstacle is the way", source_author: "Marcus Aurelius" },
		],
	},
	{
		text: "journal: today I finally finished the move and felt relieved",
		expect: [{ action: "create_journal_entry" }],
	},
	// A reference to something v1 cannot resolve (a saved quote) must be
	// flagged, not guessed into a note or a task.
	{
		text: "add a thought to the Cal Newport quote about focus: depth needs boredom",
		expect: [{ action: "needs_review" }],
	},
	// Nothing to do.
	{ text: "hmm", expect: [] },
	// A task and an event from one pt-BR sentence.
	{
		text: "reunião com o João amanhã às 10 e antes disso imprimir o contrato",
		expect: [
			{ action: "create_event", start_date: TOMORROW, start_time: "10:00" },
			{ action: "create_task", title: "imprimir o contrato", project: null },
		],
	},
];

type Miss = { field: string; want: unknown; got: unknown };

/** Case, accents and punctuation are not answers — everything else is. */
function normalized(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

// Fields compared as text rather than by exact value.
const TEXT_FIELDS = new Set(["title", "text", "source_author"]);

function scoreFields(got: Record<string, unknown>, want: Fields, text: string): Miss[] {
	const misses: Miss[] = [];
	for (const [field, expected] of Object.entries(want)) {
		if (field === "action") continue;
		const actual = got[field] ?? null;
		if (TEXT_FIELDS.has(field) && expected !== null) {
			// Not string equality — "Ask refunds" and "ask refunds" are the same
			// answer and punctuation is noise — but not the guard alone either.
			// The guard only asks whether words were ADDED, so on its own it
			// scored "home: Ask refunds today" as a clean title for that very
			// utterance, and every case's title passed for free.
			if (typeof actual !== "string") {
				misses.push({ field, want: expected, got: actual });
			} else if (field === "title" && guardTitle(actual, text).substituted) {
				misses.push({ field, want: "words from the utterance", got: actual });
			} else if (normalized(actual) !== normalized(expected)) {
				misses.push({ field, want: expected, got: actual });
			}
			continue;
		}
		if (expected !== actual) misses.push({ field, want: expected, got: actual });
	}
	return misses;
}

function scoreQuickAdd(got: Record<string, unknown> | null, want: Fields, text: string): Miss[] {
	if (!got) return [{ field: "task", want: "a task", got: null }];
	return scoreFields(got, want, text);
}

/**
 * Each expected action is paired with the first unused action of the same
 * verb, so order between verbs does not matter but order within one verb does
 * (the two tasks of "buy milk and call mom" are scored as said). A count
 * mismatch is its own miss: an extra action is as wrong as a missing one.
 */
function scorePalette(
	got: Array<Record<string, unknown>>,
	want: ExpectedAction[],
	text: string,
): Miss[] {
	const misses: Miss[] = [];
	if (got.length !== want.length) {
		misses.push({
			field: "actions",
			want: want.map((a) => a.action),
			got: got.map((a) => a.action),
		});
	}
	const used = new Set<number>();
	for (const expected of want) {
		const index = got.findIndex((a, i) => !used.has(i) && a.action === expected.action);
		if (index === -1) {
			if (got.length === want.length) {
				misses.push({ field: "actions", want: expected.action, got: got.map((a) => a.action) });
			}
			continue;
		}
		used.add(index);
		for (const m of scoreFields(got[index], expected, text)) {
			misses.push({ ...m, field: `${expected.action}.${m.field}` });
		}
	}
	return misses;
}

const args = process.argv.slice(2);
const flag = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? undefined : args[i + 1];
};
const runs = Number(flag("runs") ?? 3);
const suite = flag("suite") ?? "all";
if (!["all", "quick-add", "palette"].includes(suite)) {
	console.error(`unknown --suite ${suite} (all | quick-add | palette)`);
	process.exit(2);
}
if (flag("model")) process.env.PARSER_MODEL = flag("model");
// Anthropic effort, forwarded through the gateway. Unset = the app's own
// setting (MODEL_PROVIDER_OPTIONS, via parseCallOptions), so a bare run scores
// exactly what production sends.
const effort = flag("effort");
const effortOverride = effort ? { providerOptions: { anthropic: { effort } } } : {};

let attempts = 0;
let clean = 0;
const byField = new Map<string, number>();
const latencies: number[] = [];
let outputTokens = 0;

/**
 * An error that says nothing about the parser: no credit, a bad key, a rate
 * limit. Scoring these as misses turns a billing problem into a fake model
 * result and keeps spending calls, so the eval stops at the first one. The AI
 * SDK can wrap the real error (retries), so the chain is walked.
 */
const INFRASTRUCTURE_ERRORS = new Set([
	"GatewayAuthenticationError",
	"GatewayForbiddenError",
	"GatewayRateLimitError",
	"GatewayModelNotFoundError",
]);

// The gateway colours its messages for a terminal; strip that before matching.
const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function infrastructureError(error: unknown): string | null {
	let current: unknown = error;
	for (let depth = 0; current && depth < 5; depth++) {
		const e = current as {
			name?: string;
			statusCode?: number;
			message?: string;
			lastError?: unknown;
			cause?: unknown;
		};
		const message = (e.message ?? "").replace(ANSI_COLOR, "").split("\n")[0];
		if (e.name && INFRASTRUCTURE_ERRORS.has(e.name)) return `${e.name}: ${message}`;
		if (e.statusCode && [401, 402, 403, 429].includes(e.statusCode)) {
			return `HTTP ${e.statusCode}: ${message}`;
		}
		if (/credit balance|unauthenticated|unauthori[sz]ed|rate limit|quota/i.test(message))
			return message;
		current = e.lastError ?? e.cause;
	}
	return null;
}

/**
 * Runs one case `runs` times in parallel and prints its line. A throw is the
 * worst outcome in production too — it is what degrades a capture to its raw
 * text — so it is scored, not skipped.
 */
async function runCase(text: string, call: () => Promise<Miss[]>): Promise<number> {
	const results = await Promise.all(
		Array.from({ length: runs }, async () => {
			try {
				return await call();
			} catch (error) {
				const fatal = infrastructureError(error);
				if (fatal) {
					console.error(`\nstopped: not a parser failure — ${fatal}`);
					process.exit(3);
				}
				return [{ field: "threw", want: "a parse", got: (error as Error).message }];
			}
		}),
	);
	let cleanRuns = 0;
	for (const misses of results) {
		attempts += 1;
		if (misses.length === 0) cleanRuns += 1;
		for (const m of misses) byField.set(m.field, (byField.get(m.field) ?? 0) + 1);
	}
	clean += cleanRuns;
	const mark = cleanRuns === runs ? "PASS" : cleanRuns === 0 ? "FAIL" : "FLAKY";
	console.log(`${mark.padEnd(5)} ${cleanRuns}/${runs}  ${text}`);
	for (const misses of results) {
		for (const m of misses) {
			console.log(
				`        ${m.field}: want ${JSON.stringify(m.want)}, got ${JSON.stringify(m.got)}`,
			);
		}
	}
	return cleanRuns;
}

async function timed<T extends { usage: { outputTokens?: number } }>(
	call: () => Promise<T>,
): Promise<T> {
	const started = performance.now();
	const result = await call();
	latencies.push(performance.now() - started);
	outputTokens += result.usage.outputTokens ?? 0;
	return result;
}

const suiteTotals: string[] = [];

if (suite !== "palette") {
	console.log("── quick-add ──");
	const system = taskCaptureSystemPrompt();
	let suiteClean = 0;
	for (const testCase of QUICK_ADD) {
		suiteClean += await runCase(testCase.text, async () => {
			const { object } = await timed(() =>
				generateObject({
					model: parserModel(),
					schema: z.object({ task: CreateTaskActionSchema.nullable() }),
					system,
					prompt: captureUserMessage(testCase.text, CTX),
					...parseCallOptions(),
					...effortOverride,
				}),
			);
			return scoreQuickAdd(
				object.task as Record<string, unknown> | null,
				testCase.expect,
				testCase.text,
			);
		});
	}
	suiteTotals.push(`quick-add ${suiteClean}/${QUICK_ADD.length * runs}`);
}

if (suite !== "quick-add") {
	console.log("── palette ──");
	const system = captureSystemPrompt();
	let suiteClean = 0;
	for (const testCase of PALETTE) {
		suiteClean += await runCase(testCase.text, async () => {
			const { object } = await timed(() =>
				generateObject({
					model: parserModel(),
					schema: z.object({ actions: CaptureActionsSchema }),
					system,
					prompt: captureUserMessage(testCase.text, CTX),
					...parseCallOptions(),
					...effortOverride,
				}),
			);
			return scorePalette(
				object.actions as Array<Record<string, unknown>>,
				testCase.expect,
				testCase.text,
			);
		});
	}
	suiteTotals.push(`palette ${suiteClean}/${PALETTE.length * runs}`);
}

console.log(`\nmodel ${process.env.PARSER_MODEL ?? "(env default)"}`);
console.log(`effort ${effort ?? "(app default)"}`);
console.log(
	`clean ${clean}/${attempts} (${Math.round((clean / attempts) * 100)}%) · ${suiteTotals.join(" · ")}`,
);
if (latencies.length > 0) {
	const sorted = [...latencies].sort((a, b) => a - b);
	const pct = (p: number) =>
		(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] / 1000).toFixed(1);
	console.log(
		`latency p50 ${pct(0.5)}s, p90 ${pct(0.9)}s · output tokens avg ${Math.round(outputTokens / latencies.length)}`,
	);
}
if (byField.size > 0) {
	const worst = [...byField.entries()].sort((a, b) => b[1] - a[1]);
	console.log(`misses by field: ${worst.map(([f, n]) => `${f}=${n}`).join(", ")}`);
}
// Non-zero on any miss, so this can gate a prompt change in CI later.
process.exit(clean === attempts ? 0 : 1);
