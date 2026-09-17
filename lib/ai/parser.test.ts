import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { parse } from "@/lib/ai/parser";

vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(),
	parserModel: vi.fn(() => ({})),
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";
import { CaptureActionsSchema, CreateTaskActionSchema } from "@/lib/schemas/capture";

const CTX = { tz: "America/Sao_Paulo", todayIso: "2026-07-15", nowUtc: "2026-07-15T12:00:00Z" };

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

	// Latency here is queueing variance, not prompt size: the same utterance
	// measured 1.7s and 21s across runs. Racing two attempts halves the median.
	it("races more than one attempt and takes the first success", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		let call = 0;
		(generateObject as Mock).mockImplementation(async () => {
			call += 1;
			// The first attempt fails; the race must still yield the second's answer.
			if (call === 1) throw new Error("gateway hiccup");
			return { object: { actions: [{ action: "create_task", title: "ligar" }] } };
		});

		const result = await parse("ligar", CTX);

		expect((generateObject as Mock).mock.calls.length).toBeGreaterThan(1);
		expect(result).toEqual({ ok: true, actions: [{ action: "create_task", title: "ligar" }] });
	});

	it("aborts the losing attempt once a winner returns", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		const signals: AbortSignal[] = [];
		(generateObject as Mock).mockImplementation(async (opts: { abortSignal: AbortSignal }) => {
			signals.push(opts.abortSignal);
			return { object: { actions: [] } };
		});

		await parse("hmm", CTX);

		expect(signals.length).toBeGreaterThan(1);
		expect(signals.every((s) => s.aborted)).toBe(true);
	});

	it("omits the routing block when no domains/projects are given", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", CTX);

		const { system } = (generateObject as Mock).mock.calls[0][0];
		expect(system).not.toContain("KNOWN DOMAINS");
		expect(system).not.toContain("KNOWN PROJECTS");
	});

	it("includes the routing block when domains/projects are given", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", { ...CTX, domains: ["Home"], projects: ["Reviews"] });

		const { system } = (generateObject as Mock).mock.calls[0][0];
		expect(system).toContain("KNOWN DOMAINS: Home");
		expect(system).toContain("KNOWN PROJECTS: Reviews");
	});

	// Three rules the prompt lost or got wrong once each, and whose absence is
	// invisible until a capture comes back wrong days later. Asserting the copy
	// is blunt, but the prompt IS the implementation for these.
	it("tells the model a project already carries its domain", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", { ...CTX, domains: ["Home"], projects: ["Reviews"] });

		const system = (generateObject as Mock).mock.calls[0][0].system as string;
		expect(system).toContain("A project already belongs to a domain");
		// The old copy, which contradicted both the data and resolveTaskRouting.
		expect(system).not.toContain("INDEPENDENT");
	});

	it("asks for an absent key rather than a stand-in value", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });

		await parse("hmm", { ...CTX, domains: ["Home"], projects: ["Reviews"] });

		const system = (generateObject as Mock).mock.calls[0][0].system as string;
		expect(system).toContain("must be ABSENT from the JSON object");
		// An earlier draft said "to OMIT a field" in capitals and the model
		// began answering `project: "#OMIT#"` — writing the keyword as a value.
		expect(system).not.toContain("LEAVE THE KEY OUT");
	});
});

describe("shared prompt fragments", () => {
	it("names the day words, rather than only asking for 'relative dates'", async () => {
		// "Resolve relative dates" alone was not actionable: the measured result
		// was "today" dropped in 15 of 15 runs, landing in neither the title nor
		// due_date.
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		const system = (generateObject as Mock).mock.calls[0][0].system as string;
		expect(system).toContain("ANY word naming a day is a due_date");
		expect(system).toContain("today/tonight/hoje");
		expect(system).toContain("tomorrow/amanhã");
	});

	it("resolves relative dates against the app timezone", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [] } });
		await parse("hmm", CTX);
		const system = (generateObject as Mock).mock.calls[0][0].system as string;
		expect(system).toContain("NOW=2026-07-15T12:00:00Z");
		expect(system).toContain("TODAY=2026-07-15");
		expect(system).toContain("timezone America/Sao_Paulo");
		expect(system).toContain("priority is 1 (highest) to 4.");
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
});
