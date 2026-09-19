/**
 * Parser eval — scores the real prompt against the real gateway.
 *
 * The capture parser is the one part of Dispatch whose correctness cannot be
 * unit-tested: its behaviour lives in a model, so a prompt edit that reads like
 * an improvement can silently make things worse, and the only evidence anyone
 * had was "it felt wrong again today". This turns that into a number.
 *
 * It calls the SAME prompt builders the app uses (lib/ai/parser.ts), so a
 * prompt change is scored the moment it is made — nothing here restates the
 * prompt, which is what would let the eval drift away from production.
 *
 *   bun run eval:parser
 *   bun run eval:parser --runs 5
 *   bun run eval:parser --model anthropic/claude-haiku-4.5
 *
 * Needs AI_GATEWAY_API_KEY, so load the env first:
 *   set -a && . ./.env.local && set +a && bun run eval:parser
 *
 * The script alias carries `--conditions=react-server`, which is what lets a
 * `server-only` module be imported outside Next — without it every file in
 * lib/ai throws on import and the eval cannot reach the prompt it scores.
 *
 * Each case states only the fields it CARES about. A field the case does not
 * mention is not scored, except `project`, which every case scores: inventing
 * a project was the single most common failure, and it is only visible as the
 * absence of something.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { parserModel } from "@/lib/ai/gateway";
import {
	dateResolution,
	parseCallOptions,
	recurrenceRules,
	routingBlock,
	TASK_FIELD_FORMATS,
} from "@/lib/ai/parser";
import { guardTitle } from "@/lib/ai/verbatim";
import { CreateTaskActionSchema } from "@/lib/schemas/capture";

// A fixed world, so a case's expected date never depends on the day the eval
// runs. TODAY is a Thursday, which makes "sexta"/"Friday" a one-day hop and
// "next Monday" a four-day one — both distinguishable from a lazy TODAY+1.
const TODAY = "2026-09-17";
const CTX = {
	tz: "America/Sao_Paulo",
	todayIso: TODAY,
	nowUtc: `${TODAY}T14:00:00Z`,
	domains: ["Home", "Work", "Health", "Money", "Learning"],
	projects: ["Dispatch", "Apartment move", "Taxes 2026"],
};

type Expected = {
	title?: string;
	due_date?: string | null;
	due_time?: string | null;
	domain?: string | null;
	/** Always scored. `null` means "must be absent". */
	project?: string | null;
	recurrence_rule?: string | null;
};

const CASES: { text: string; expect: Expected }[] = [
	// The capture that started this: a domain prefix, a day word, no project.
	{
		text: "home: Ask refunds today",
		expect: { title: "Ask refunds", due_date: TODAY, domain: "Home", project: null },
	},
	{
		text: "work: send the invoice tomorrow at 9",
		expect: {
			title: "send the invoice",
			due_date: "2026-09-18",
			due_time: "09:00",
			domain: "Work",
			project: null,
		},
	},
	// Dictated pt-BR: no punctuation, destination is just the first word.
	{
		text: "saúde marcar dentista sexta",
		expect: { title: "marcar dentista", due_date: "2026-09-18", domain: "Health", project: null },
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
	{
		text: "pay the rent every month",
		expect: { recurrence_rule: "monthly", project: null },
	},
	{
		text: "gym every Tuesday and Saturday",
		expect: { recurrence_rule: "weekly:tu,sa", project: null },
	},
	// A day word with no other anchor: dropping it is the failure being watched.
	{ text: "call the landlord tonight", expect: { due_date: TODAY, project: null } },
];

function taskPrompt(): string {
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
		...dateResolution(CTX),
		...routingBlock(CTX),
		"",
		'Return a JSON object of the form {"task": { ... }} or {"task": null}.',
	].join("\n");
}

type Miss = { field: string; want: unknown; got: unknown };

/** Case, accents and punctuation are not answers — everything else is. */
function normalized(s: string): string {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^\p{L}\p{N}]+/gu, " ")
		.trim();
}

function score(got: Record<string, unknown> | null, want: Expected, text: string): Miss[] {
	if (!got) return [{ field: "task", want: "a task", got: null }];
	const misses: Miss[] = [];
	for (const [field, expected] of Object.entries(want)) {
		const actual = got[field] ?? null;
		if (field === "title") {
			// Not string equality — "Ask refunds" and "ask refunds" are the same
			// answer and punctuation is noise — but not the guard alone either.
			// The guard only asks whether words were ADDED, so on its own it
			// scored "home: Ask refunds today" as a clean title for that very
			// utterance, and every case's title passed for free.
			if (typeof actual !== "string") {
				misses.push({ field, want: expected, got: actual });
			} else if (guardTitle(actual, text).substituted) {
				misses.push({ field, want: "words from the utterance", got: actual });
			} else if (normalized(actual) !== normalized(String(expected))) {
				misses.push({ field, want: expected, got: actual });
			}
			continue;
		}
		if ((expected ?? null) !== actual) misses.push({ field, want: expected ?? null, got: actual });
	}
	return misses;
}

const args = process.argv.slice(2);
const flag = (name: string) => {
	const i = args.indexOf(`--${name}`);
	return i === -1 ? undefined : args[i + 1];
};
const runs = Number(flag("runs") ?? 3);
if (flag("model")) process.env.PARSER_MODEL = flag("model");

const system = taskPrompt();
let attempts = 0;
let clean = 0;
const byField = new Map<string, number>();

for (const testCase of CASES) {
	const caseMisses: Miss[][] = [];
	for (let i = 0; i < runs; i++) {
		attempts += 1;
		try {
			const { object } = await generateObject({
				model: parserModel(),
				schema: z.object({ task: CreateTaskActionSchema.nullable() }),
				system,
				prompt: testCase.text,
				...parseCallOptions(),
			});
			const misses = score(
				object.task as Record<string, unknown> | null,
				testCase.expect,
				testCase.text,
			);
			if (misses.length === 0) clean += 1;
			for (const m of misses) byField.set(m.field, (byField.get(m.field) ?? 0) + 1);
			caseMisses.push(misses);
		} catch (error) {
			// A throw here is the worst outcome in production too — it is what
			// degrades a capture to its raw text — so it is scored, not skipped.
			byField.set("threw", (byField.get("threw") ?? 0) + 1);
			caseMisses.push([{ field: "threw", want: "a parse", got: (error as Error).message }]);
		}
	}
	const cleanRuns = caseMisses.filter((m) => m.length === 0).length;
	const mark = cleanRuns === runs ? "PASS" : cleanRuns === 0 ? "FAIL" : "FLAKY";
	console.log(`${mark.padEnd(5)} ${cleanRuns}/${runs}  ${testCase.text}`);
	for (const misses of caseMisses) {
		for (const m of misses) {
			console.log(
				`        ${m.field}: want ${JSON.stringify(m.want)}, got ${JSON.stringify(m.got)}`,
			);
		}
	}
}

console.log(`\nmodel ${process.env.PARSER_MODEL ?? "(env default)"}`);
console.log(`clean ${clean}/${attempts} (${Math.round((clean / attempts) * 100)}%)`);
if (byField.size > 0) {
	const worst = [...byField.entries()].sort((a, b) => b[1] - a[1]);
	console.log(`misses by field: ${worst.map(([f, n]) => `${f}=${n}`).join(", ")}`);
}
// Non-zero on any miss, so this can gate a prompt change in CI later.
process.exit(clean === attempts ? 0 : 1);
