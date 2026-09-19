import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { parse } from "@/lib/ai/parser";

vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(),
	parserModel: vi.fn(() => ({})),
	MODEL_PROVIDER_OPTIONS: { anthropic: { effort: "low" } },
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";
import { CaptureActionsSchema, CreateTaskActionSchema } from "@/lib/schemas/capture";

const CTX = { tz: "America/Sao_Paulo", todayIso: "2026-07-15", nowUtc: "2026-07-15T12:00:00Z" };
const ROUTED = { ...CTX, domains: ["Home"], projects: [{ name: "Reviews", domain: "Work" }] };

/** The system prompt's text, whether it was sent as a string or a message. */
function systemText(): string {
	const { system } = (generateObject as Mock).mock.calls[0][0];
	return typeof system === "string" ? system : system.content;
}

function userMessage(): string {
	return (generateObject as Mock).mock.calls[0][0].prompt;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("parse", () => {
	it("returns unavailable when the gateway is not configured", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);

		const result = await parse("cria uma tarefa", CTX);

		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "cria uma tarefa" });
		expect(generateObject).not.toHaveBeenCalled();
	});

	it("returns failed when the model call throws or its output is invalid", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockRejectedValue(new Error("NoObjectGeneratedError"));

		const result = await parse("blah", CTX);

		expect(result).toEqual({ ok: false, reason: "failed", raw: "blah" });
	});

	it("returns empty when the parser finds nothing actionable", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		const result = await parse("hmm", CTX);

		expect(result).toEqual({ ok: false, reason: "empty", raw: "hmm" });
	});

	it("maps a schema-mismatch (unknown verb) to a typed failed result", async () => {
		// generateObject enforces CaptureActionsSchema and throws when the model's
		// output does not match — an unknown verb is exactly such a mismatch. The
		// parser catches that and degrades to `failed` rather than crashing.
		expect(CaptureActionsSchema.safeParse([{ action: "create_project", name: "x" }]).success).toBe(
			false,
		);

		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockRejectedValue(new Error("TypeValidationError"));

		const result = await parse("um novo projeto", CTX);

		expect(result).toEqual({ ok: false, reason: "failed", raw: "um novo projeto" });
	});

	it("returns the parsed actions on success", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({
			object: { actions: [{ action: "create_task", title: "ligar pro médico" }] },
		});

		const result = await parse("ligar pro médico", CTX);

		expect(result).toEqual({
			ok: true,
			actions: [{ action: "create_task", title: "ligar pro médico" }],
		});
	});

	it("caps retries, output tokens, and wall time on the model call", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);

		const call = (generateObject as Mock).mock.calls[0][0];
		expect(call.maxRetries).toBe(1);
		expect(call.maxOutputTokens).toBe(400);
		expect(call.abortSignal).toBeInstanceOf(AbortSignal);
	});

	// Measured: effort low beat the default (high) on the parser eval, on both
	// Sonnet 5 and Opus 5. Leaving it unset silently restores the default.
	it("asks for effort low", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);

		const call = (generateObject as Mock).mock.calls[0][0];
		expect(call.providerOptions).toEqual({ anthropic: { effort: "low" } });
	});

	// The budget covers the whole call — every attempt plus the backoff between
	// them. At 8s it aborted the gateway's ordinary tail (~19s observed) and
	// degraded parseable utterances to needs_review notes, so a slow-but-fine
	// call is asserted to survive rather than left to drift back down.
	it("lets a 20s model call finish instead of aborting it", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		vi.useFakeTimers();
		try {
			(generateObject as Mock).mockImplementation(async (opts: { abortSignal: AbortSignal }) => {
				await vi.advanceTimersByTimeAsync(20_000);
				if (opts.abortSignal.aborted) throw new Error("aborted mid-call");
				return { object: { actions: [] } };
			});

			// "empty" (not "failed") proves the call completed rather than aborting.
			await expect(parse("hmm", CTX)).resolves.toEqual({
				ok: false,
				reason: "empty",
				raw: "hmm",
			});
		} finally {
			vi.useRealTimers();
		}
	});

	it("makes one model call per parse", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		expect(generateObject).toHaveBeenCalledTimes(1);
	});

	it("leaves the lists out of <context> when there are none", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);

		expect(userMessage()).not.toContain('"domains"');
		expect(userMessage()).not.toContain('"projects"');
	});

	it("sends the lists in <context>, each project with its domain", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", ROUTED);

		const context = JSON.parse(userMessage().split("<context>")[1].split("</context>")[0]);
		expect(context.domains).toEqual(["Home"]);
		expect(context.projects).toEqual([{ name: "Reviews", domain: "Work" }]);
	});

	// Caching matches the start of the request byte for byte. Anything that
	// changes per call inside the system prompt makes every request unique.
	it("keeps the system prompt identical whatever the context", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);
		await parse("other", { ...ROUTED, nowUtc: "2027-01-01T00:00:00Z", todayIso: "2027-01-01" });

		const [first, second] = (generateObject as Mock).mock.calls.map((c) => c[0].system);
		expect(second).toEqual(first);
	});

	it("marks the system prompt for prompt caching", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);

		const { system } = (generateObject as Mock).mock.calls[0][0];
		expect(system.role).toBe("system");
		expect(system.providerOptions).toEqual({
			anthropic: { cacheControl: { type: "ephemeral" } },
		});
	});

	it("puts the utterance after the context, inside its own tags", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("comprar pão", ROUTED);

		expect(userMessage()).toMatch(/<\/context>\s+<utterance>\ncomprar pão\n<\/utterance>$/);
	});

	// Three rules the prompt lost or got wrong once each, and whose absence is
	// invisible until a capture comes back wrong days later. Asserting the copy
	// is blunt, but the prompt IS the implementation for these.
	it("tells the model a project already carries its domain", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", ROUTED);

		const system = systemText();
		expect(system).toContain("A project already belongs to a domain");
		// The old copy, which contradicted both the data and resolveTaskRouting.
		expect(system).not.toContain("INDEPENDENT");
	});

	it("asks for an absent key rather than a stand-in value", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", ROUTED);

		const system = systemText();
		expect(system).toContain("must be ABSENT from the JSON object");
		// An earlier draft said "to OMIT a field" in capitals and the model
		// began answering `project: "#OMIT#"` — writing the keyword as a value.
		expect(system).not.toContain("LEAVE THE KEY OUT");
	});
});

describe("shared prompt fragments", () => {
	it("sets priority only on a spoken signal", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		const system = systemText();
		expect(system).toContain("priority is set ONLY when the user signals it");
		expect(system).toContain("No signal → leave priority out.");
	});

	it("drops filler words but never rewords a title", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		expect(systemText()).toContain("Never reword, reorder or add a word.");
	});

	it("lets the model name a project by the phrase the user said", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		expect(systemText()).toContain("Never write a phrase the user did not say.");
		expect(systemText()).not.toContain("EXACTLY as listed");
	});

	it("names the day words, rather than only asking for 'relative dates'", async () => {
		// "Resolve relative dates" alone was not actionable: the measured result
		// was "today" dropped in 15 of 15 runs, landing in neither the title nor
		// due_date.
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		const system = systemText();
		expect(system).toContain("ANY word naming a day is a due_date");
		expect(system).toContain("today/tonight/hoje");
		expect(system).toContain("tomorrow/amanhã");
	});

	it("resolves relative dates against the app timezone", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		expect(userMessage()).toContain('"now": "2026-07-15T12:00:00Z"');
		expect(userMessage()).toContain('"today": "2026-07-15"');
		expect(userMessage()).toContain('"timezone": "America/Sao_Paulo"');
		expect(systemText()).toContain("priority is 1 (high), 2 (medium) or 3 (low).");
	});

	it("gives NOW in whole seconds", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", { ...CTX, nowUtc: "2026-07-15T12:00:00.123Z" });
		expect(userMessage()).toContain('"now": "2026-07-15T12:00:00Z"');
	});
});

describe("CreateTaskActionSchema", () => {
	it("accepts notes, recurrence_rule, domain, and project", () => {
		const result = CreateTaskActionSchema.safeParse({
			action: "create_task",
			title: "water plants",
			notes: "every Monday per the parser",
			recurrence_rule: "weekly",
			domain: "Home",
			project: "Garden",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a recurrence_rule outside the enum", () => {
		const result = CreateTaskActionSchema.safeParse({
			action: "create_task",
			title: "water plants",
			recurrence_rule: "every monday",
		});
		expect(result.success).toBe(false);
	});

	it("accepts priority 1–3 and rejects 4, which no longer exists", () => {
		const task = (priority: number) =>
			CreateTaskActionSchema.safeParse({ action: "create_task", title: "x", priority }).success;
		expect([1, 2, 3].map(task)).toEqual([true, true, true]);
		expect(task(4)).toBe(false);
	});
});
