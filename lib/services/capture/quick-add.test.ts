import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(() => true),
	parserModel: vi.fn(() => ({})),
	MODEL_PROVIDER_OPTIONS: { anthropic: { effort: "low" } },
}));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";
import { parseTaskCapture } from "@/lib/services/capture/quick-add";

const CTX = { tz: "America/Sao_Paulo", todayIso: "2026-07-15", nowUtc: "2026-07-15T12:00:00Z" };

beforeEach(() => {
	vi.clearAllMocks();
	(isAiConfigured as Mock).mockReturnValue(true);
});

function parsedTask(task: Record<string, unknown> | null) {
	(generateObject as Mock).mockResolvedValue({ object: { task } });
}

describe("parseTaskCapture", () => {
	it("returns unavailable when the gateway is not configured", async () => {
		(isAiConfigured as Mock).mockReturnValue(false);
		const result = await parseTaskCapture("pagar aluguel", CTX);
		expect(result).toEqual({ ok: false, reason: "unavailable", raw: "pagar aluguel" });
		expect(generateObject).not.toHaveBeenCalled();
	});

	it("returns failed when the model call throws", async () => {
		(generateObject as Mock).mockRejectedValue(new Error("boom"));
		expect(await parseTaskCapture("blah", CTX)).toEqual({
			ok: false,
			reason: "failed",
			raw: "blah",
		});
	});

	it("returns empty when the model finds no task", async () => {
		parsedTask(null);
		expect(await parseTaskCapture("hmm", CTX)).toEqual({
			ok: false,
			reason: "empty",
			raw: "hmm",
		});
	});

	it("returns the parsed task on success", async () => {
		parsedTask({ action: "create_task", title: "pagar aluguel" });
		expect(await parseTaskCapture("pagar aluguel", CTX)).toEqual({
			ok: true,
			task: { action: "create_task", title: "pagar aluguel" },
		});
	});

	it("resolves relative dates against the app timezone", async () => {
		parsedTask(null);
		await parseTaskCapture("hmm", CTX);
		const { system, prompt } = (generateObject as Mock).mock.calls[0][0];
		expect(prompt).toContain('"now": "2026-07-15T12:00:00Z"');
		expect(prompt).toContain('"today": "2026-07-15"');
		expect(prompt).toContain('"timezone": "America/Sao_Paulo"');
		expect(prompt).toContain("<utterance>\nhmm\n</utterance>");
		expect(system.content).toContain("priority is 1 (high), 2 (medium) or 3 (low).");
		expect(system.providerOptions.anthropic.cacheControl).toEqual({ type: "ephemeral" });
	});
});
