import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { parse } from "@/lib/ai/parser";

vi.mock("@/lib/ai/gateway", () => ({
	isAiConfigured: vi.fn(),
	parserModel: vi.fn(() => ({})),
}));
vi.mock("ai", () => ({ generateObject: vi.fn() }));

import { generateObject } from "ai";
import { isAiConfigured } from "@/lib/ai/gateway";

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
});
