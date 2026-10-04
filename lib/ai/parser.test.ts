import { APICallError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parse, parseTask, requestActions, requestTask } from "@/lib/ai/parser";
import { CaptureActionsSchema, CreateTaskActionSchema } from "@/lib/schemas/capture";
import { fakeParserModel, sentOptions, sentSystem, sentUser } from "@/test/fakes/parser-model";

const CTX = { tz: "America/Sao_Paulo", todayIso: "2026-07-15", nowUtc: "2026-07-15T12:00:00Z" };
const ROUTED = { ...CTX, domains: ["Home"], projects: [{ name: "Reviews", domain: "Work" }] };

const NOTHING = { actions: [] };

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("parse", () => {
	it("returns unavailable when there is no model", async () => {
		const result = await parse("cria uma tarefa", CTX, { model: null });

		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "cria uma tarefa" });
	});

	// Unit runs drop AI_GATEWAY_API_KEY (test/unit/setup.ts), so the app's
	// default — no model passed — is the unconfigured gateway.
	it("returns unavailable when the gateway is not configured", async () => {
		const result = await parse("cria uma tarefa", CTX);

		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "cria uma tarefa" });
	});

	it("returns failed when the model call throws", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const model = fakeParserModel(new Error("boom"));

		const result = await parse("blah", CTX, { model });

		expect(result).toEqual({ ok: false, reason: "failed", raw: "blah" });
		expect(console.warn).toHaveBeenCalledWith("parse failed", {
			where: "parse",
			name: "Error",
			message: "boom",
		});
	});

	it("returns empty when the parser finds nothing actionable", async () => {
		const result = await parse("hmm", CTX, { model: fakeParserModel(NOTHING) });

		expect(result).toEqual({ ok: false, reason: "empty", raw: "hmm" });
	});

	it("maps a schema-mismatch (unknown verb) to a typed failed result", async () => {
		// generateObject enforces CaptureActionsSchema and throws when the model's
		// output does not match — an unknown verb is exactly such a mismatch. The
		// parser catches that and degrades to `failed` rather than crashing.
		expect(CaptureActionsSchema.safeParse([{ action: "create_project", name: "x" }]).success).toBe(
			false,
		);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const model = fakeParserModel({ actions: [{ action: "create_project", name: "x" }] });

		const result = await parse("um novo projeto", CTX, { model });

		expect(result).toEqual({ ok: false, reason: "failed", raw: "um novo projeto" });
	});

	it("returns the parsed actions on success", async () => {
		const model = fakeParserModel({
			actions: [{ action: "create_task", title: "ligar pro médico" }],
		});

		const result = await parse("ligar pro médico", CTX, { model });

		expect(result).toEqual({
			ok: true,
			actions: [{ action: "create_task", title: "ligar pro médico" }],
		});
	});

	// lib/ai/verbatim.ts: a title made of words the user never said is worse
	// than the raw sentence.
	it("replaces a title with a word the user never said by the raw text", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const model = fakeParserModel({
			actions: [{ action: "create_task", title: "telefonar ao médico" }],
		});

		const result = await parse("ligar pro médico", CTX, { model });

		expect(result).toEqual({
			ok: true,
			actions: [{ action: "create_task", title: "ligar pro médico" }],
		});
		expect(console.warn).toHaveBeenCalledWith("parse title not verbatim", {
			action: "create_task",
		});
	});

	it("caps output tokens and wall time on the model call", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", CTX, { model });

		expect(sentOptions(model).maxOutputTokens).toBe(400);
		expect(sentOptions(model).abortSignal).toBeInstanceOf(AbortSignal);
	});

	// One retry, not the SDK's default two: a schema miss should not triple.
	it("retries a retryable failure once", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.useFakeTimers();
		const model = fakeParserModel(
			new APICallError({
				message: "overloaded",
				url: "https://gateway.test",
				requestBodyValues: {},
				statusCode: 529,
				isRetryable: true,
			}),
		);

		const result = parse("hmm", CTX, { model });
		await vi.advanceTimersByTimeAsync(3_000);

		await expect(result).resolves.toEqual({ ok: false, reason: "failed", raw: "hmm" });
		expect(model.doGenerateCalls).toHaveLength(2);
	});

	// Measured: effort low beat the default (high) on the parser eval, on both
	// Sonnet 5 and Opus 5. Leaving it unset silently restores the default.
	it("asks for effort low", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", CTX, { model });

		expect(sentOptions(model).providerOptions).toEqual({ anthropic: { effort: "low" } });
	});

	// The budget covers the whole call — every attempt plus the backoff between
	// them. At 8s it aborted the gateway's ordinary tail (~19s observed) and
	// degraded parseable utterances to needs_review notes, so a slow-but-fine
	// call is asserted to survive rather than left to drift back down.
	it("lets a 20s model call finish instead of aborting it", async () => {
		vi.useFakeTimers();
		const model = fakeParserModel(async (opts) => {
			await vi.advanceTimersByTimeAsync(20_000);
			if (opts.abortSignal?.aborted) throw new Error("aborted mid-call");
			return NOTHING;
		});

		// "empty" (not "failed") proves the call completed rather than aborting.
		await expect(parse("hmm", CTX, { model })).resolves.toEqual({
			ok: false,
			reason: "empty",
			raw: "hmm",
		});
	});

	it("makes one model call per parse", async () => {
		const model = fakeParserModel(NOTHING);
		await parse("hmm", CTX, { model });
		expect(model.doGenerateCalls).toHaveLength(1);
	});

	it("leaves the lists out of <context> when there are none", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", CTX, { model });

		expect(sentUser(model)).not.toContain('"domains"');
		expect(sentUser(model)).not.toContain('"projects"');
	});

	it("sends the lists in <context>, each project with its domain", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", ROUTED, { model });

		const context = JSON.parse(sentUser(model).split("<context>")[1].split("</context>")[0]);
		expect(context.domains).toEqual(["Home"]);
		expect(context.projects).toEqual([{ name: "Reviews", domain: "Work" }]);
	});

	// Caching matches the start of the request byte for byte. Anything that
	// changes per call inside the system prompt makes every request unique.
	it("keeps the system prompt identical whatever the context", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", CTX, { model });
		await parse(
			"other",
			{ ...ROUTED, nowUtc: "2027-01-01T00:00:00Z", todayIso: "2027-01-01" },
			{ model },
		);

		expect(sentSystem(model, 1)).toEqual(sentSystem(model, 0));
	});

	it("marks the system prompt for prompt caching", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("hmm", CTX, { model });

		expect(sentSystem(model).providerOptions).toEqual({
			anthropic: { cacheControl: { type: "ephemeral" } },
		});
	});

	it("puts the utterance after the context, inside its own tags", async () => {
		const model = fakeParserModel(NOTHING);

		await parse("comprar pão", ROUTED, { model });

		expect(sentUser(model)).toMatch(/<\/context>\s+<utterance>\ncomprar pão\n<\/utterance>$/);
	});
});

describe("requestActions", () => {
	it("returns the model's actions before the title guard", async () => {
		const model = fakeParserModel({
			actions: [{ action: "create_task", title: "telefonar ao médico" }],
		});

		const { actions } = await requestActions("ligar pro médico", CTX, model);

		expect(actions).toEqual([{ action: "create_task", title: "telefonar ao médico" }]);
	});

	it("throws when the model call throws", async () => {
		const model = fakeParserModel(new Error("boom"));

		await expect(requestActions("hmm", CTX, model)).rejects.toThrow("boom");
	});

	it("reports the call's token usage", async () => {
		const { usage } = await requestActions("hmm", CTX, fakeParserModel(NOTHING));

		expect(usage.outputTokens).toBe(40);
		expect(usage.inputTokenDetails.cacheReadTokens).toBe(500);
	});
});

describe("parseTask", () => {
	const TASK = { action: "create_task", title: "pagar aluguel" };

	it("returns unavailable when there is no model", async () => {
		expect(await parseTask("pagar aluguel", CTX, { model: null })).toEqual({
			ok: false,
			reason: "unavailable",
			raw: "pagar aluguel",
		});
	});

	it("returns unavailable when the gateway is not configured", async () => {
		expect(await parseTask("pagar aluguel", CTX)).toEqual({
			ok: false,
			reason: "unavailable",
			raw: "pagar aluguel",
		});
	});

	it("returns failed when the model call throws", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const model = fakeParserModel(new Error("boom"));

		expect(await parseTask("blah", CTX, { model })).toEqual({
			ok: false,
			reason: "failed",
			raw: "blah",
		});
		expect(console.warn).toHaveBeenCalledWith("parse failed", {
			where: "quick-add",
			name: "Error",
			message: "boom",
		});
	});

	it("returns empty when the model finds no task", async () => {
		expect(await parseTask("hmm", CTX, { model: fakeParserModel({ task: null }) })).toEqual({
			ok: false,
			reason: "empty",
			raw: "hmm",
		});
	});

	it("returns the parsed task on success", async () => {
		expect(
			await parseTask("pagar aluguel", CTX, { model: fakeParserModel({ task: TASK }) }),
		).toEqual({ ok: true, task: TASK });
	});

	it("replaces a title with a word the user never said by the raw text", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const model = fakeParserModel({ task: { ...TASK, title: "quitar aluguel" } });

		expect(await parseTask("pagar aluguel", CTX, { model })).toEqual({ ok: true, task: TASK });
		expect(console.warn).toHaveBeenCalledWith("quick-add title not verbatim");
	});

	it("resolves relative dates against the app timezone, behind a cached system prompt", async () => {
		const model = fakeParserModel({ task: null });

		await parseTask("hmm", CTX, { model });

		expect(sentUser(model)).toContain('"now": "2026-07-15T12:00:00Z"');
		expect(sentUser(model)).toContain('"today": "2026-07-15"');
		expect(sentUser(model)).toContain('"timezone": "America/Sao_Paulo"');
		expect(sentUser(model)).toContain("<utterance>\nhmm\n</utterance>");
		expect(sentSystem(model).content).toContain("priority is 1 (high), 2 (medium) or 3 (low).");
		expect(sentSystem(model).providerOptions).toEqual({
			anthropic: { cacheControl: { type: "ephemeral" } },
		});
	});

	it("asks for effort low", async () => {
		const model = fakeParserModel({ task: null });

		await parseTask("hmm", CTX, { model });

		expect(sentOptions(model).providerOptions).toEqual({ anthropic: { effort: "low" } });
	});
});

describe("requestTask", () => {
	it("returns the model's task before the title guard", async () => {
		const task = { action: "create_task", title: "quitar aluguel" };

		const result = await requestTask("pagar aluguel", CTX, fakeParserModel({ task }));

		expect(result.task).toEqual(task);
	});

	it("throws when the model call throws", async () => {
		await expect(requestTask("hmm", CTX, fakeParserModel(new Error("boom")))).rejects.toThrow(
			"boom",
		);
	});

	it("reports the call's token usage", async () => {
		const { usage } = await requestTask("hmm", CTX, fakeParserModel({ task: null }));

		expect(usage.outputTokens).toBe(40);
		expect(usage.inputTokenDetails.cacheReadTokens).toBe(500);
	});
});

// Rules the prompt lost or got wrong once each, and whose absence is invisible
// until a capture comes back wrong days later. Asserting the copy is blunt, but
// the prompt IS the implementation for these.
describe("shared prompt fragments", () => {
	it.each<[string, string[], string[]]>([
		[
			"tells the model a project already carries its domain",
			["A project already belongs to a domain"],
			// The old copy, which contradicted both the data and resolveTaskRouting.
			["INDEPENDENT"],
		],
		[
			"asks for an absent key rather than a stand-in value",
			["must be ABSENT from the JSON object"],
			// An earlier draft said "to OMIT a field" in capitals and the model
			// began answering `project: "#OMIT#"` — writing the keyword as a value.
			["LEAVE THE KEY OUT"],
		],
		[
			"sets priority only on a spoken signal",
			["priority is set ONLY when the user signals it", "No signal → leave priority out."],
			[],
		],
		["drops filler words but never rewords a title", ["Never reword, reorder or add a word."], []],
		[
			"lets the model name a project by the phrase the user said",
			["Never write a phrase the user did not say."],
			["EXACTLY as listed"],
		],
		[
			// "Resolve relative dates" alone was not actionable: the measured result
			// was "today" dropped in 15 of 15 runs, landing in neither the title nor
			// due_date.
			"names the day words, rather than only asking for 'relative dates'",
			["ANY word naming a day is a due_date", "today/tonight/hoje", "tomorrow/amanhã"],
			[],
		],
	])("%s", async (_name, present, absent) => {
		const model = fakeParserModel(NOTHING);
		await parse("hmm", ROUTED, { model });
		const system = sentSystem(model).content;
		for (const text of present) expect(system).toContain(text);
		for (const text of absent) expect(system).not.toContain(text);
	});

	it("resolves relative dates against the app timezone", async () => {
		const model = fakeParserModel(NOTHING);
		await parse("hmm", CTX, { model });
		expect(sentUser(model)).toContain('"now": "2026-07-15T12:00:00Z"');
		expect(sentUser(model)).toContain('"today": "2026-07-15"');
		expect(sentUser(model)).toContain('"timezone": "America/Sao_Paulo"');
		expect(sentSystem(model).content).toContain("priority is 1 (high), 2 (medium) or 3 (low).");
	});

	it("gives NOW in whole seconds", async () => {
		const model = fakeParserModel(NOTHING);
		await parse("hmm", { ...CTX, nowUtc: "2026-07-15T12:00:00.123Z" }, { model });
		expect(sentUser(model)).toContain('"now": "2026-07-15T12:00:00Z"');
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
