import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { parse, parseTaskCapture } from "@/lib/ai/parser";

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
});

describe("parseTaskCapture", () => {
	it("returns unavailable when the gateway is not configured", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);

		const result = await parseTaskCapture("pagar aluguel", CTX);

		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "pagar aluguel" });
		expect(generateObject).not.toHaveBeenCalled();
	});

	it("returns failed when the model call throws", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockRejectedValue(new Error("boom"));

		const result = await parseTaskCapture("blah", CTX);

		expect(result).toEqual({ ok: false, reason: "failed", raw: "blah" });
	});

	it("returns empty when the model finds no task", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { task: null } });

		const result = await parseTaskCapture("hmm", CTX);

		expect(result).toEqual({ ok: false, reason: "empty", raw: "hmm" });
	});

	it("returns the parsed task on success", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({
			object: { task: { action: "create_task", title: "pagar aluguel" } },
		});

		const result = await parseTaskCapture("pagar aluguel", CTX);

		expect(result).toEqual({
			ok: true,
			task: { action: "create_task", title: "pagar aluguel" },
		});
	});

	it("uses the same call budget as parse()", async () => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { task: null } });

		await parseTaskCapture("hmm", CTX);

		const call = (generateObject as Mock).mock.calls[0][0];
		expect(call.maxRetries).toBe(1);
		expect(call.maxOutputTokens).toBe(400);
		expect(call.abortSignal).toBeInstanceOf(AbortSignal);
	});
});

// The two prompts share their date-resolution and task-field copy through
// fragment builders; these assert the fragments actually reach both prompts.
describe("shared prompt fragments", () => {
	const systemFor = async (entry: typeof parse | typeof parseTaskCapture) => {
		(isAiConfigured as Mock).mockReturnValue(true);
		(generateObject as Mock).mockResolvedValue({ object: { actions: [], task: null } });
		await entry("hmm", CTX);
		return (generateObject as Mock).mock.calls[0][0].system as string;
	};

	it.each([
		["parse", parse],
		["parseTaskCapture", parseTaskCapture],
	])("%s resolves relative dates against the app timezone", async (_name, entry) => {
		const system = await systemFor(entry);
		expect(system).toContain("NOW=2026-07-15T12:00:00Z");
		expect(system).toContain("TODAY=2026-07-15");
		expect(system).toContain("timezone America/Sao_Paulo");
	});

	it.each([
		["parse", parse],
		["parseTaskCapture", parseTaskCapture],
	])("%s states the task field formats", async (_name, entry) => {
		const system = await systemFor(entry);
		expect(system).toContain("priority is 1 (highest) to 4.");
		expect(system).toContain("due_date is YYYY-MM-DD, due_time is HH:mm.");
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
