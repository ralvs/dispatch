import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { capture } from "@/lib/services/capture";

vi.mock("@/lib/services/capture/store", () => ({
	persistRaw: vi.fn(async () => "cap-1"),
	markParsed: vi.fn(async () => {}),
}));
vi.mock("@/lib/services/capture/executor", () => ({ runActions: vi.fn(async () => []) }));
vi.mock("@/lib/ai/parser", () => ({ parse: vi.fn() }));
vi.mock("@/lib/services/notes", () => ({
	createNeedsReviewNote: vi.fn(async () => ({ id: "review-1" })),
}));
vi.mock("@/lib/services/settings", () => ({
	getAppTimezone: vi.fn(async () => "America/Sao_Paulo"),
}));

import { parse } from "@/lib/ai/parser";
import { runActions } from "@/lib/services/capture/executor";
import { markParsed, persistRaw } from "@/lib/services/capture/store";
import { createNeedsReviewNote } from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";

const sb = {} as SupabaseClient;
const RAW = { kind: "transcript", text: "ligar pro médico", via: "text" } as const;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("capture", () => {
	it("persists raw first and marks parsed last", async () => {
		(parse as Mock).mockResolvedValue({
			ok: true,
			actions: [{ action: "create_task", title: "x" }],
		});

		await capture(sb, RAW);

		const persistOrder = (persistRaw as Mock).mock.invocationCallOrder[0];
		const parseOrder = (parse as Mock).mock.invocationCallOrder[0];
		const markOrder = (markParsed as Mock).mock.invocationCallOrder[0];
		expect(persistOrder).toBeLessThan(parseOrder);
		expect(parseOrder).toBeLessThan(markOrder);
	});

	it("executes parsed actions and reports the results", async () => {
		(parse as Mock).mockResolvedValue({
			ok: true,
			actions: [{ action: "create_task", title: "x" }],
		});
		(runActions as Mock).mockResolvedValue([
			{ action: "create_task", ok: true, entity: { table: "tasks", id: "task-1" } },
		]);

		const record = await capture(sb, RAW);

		expect(record.outcome.kind).toBe("executed");
		expect(runActions).toHaveBeenCalledWith(sb, [{ action: "create_task", title: "x" }], {
			capturedId: "cap-1",
			transcript: "ligar pro médico",
			tz: "America/Sao_Paulo",
		});
	});

	it("degrades a parser failure to a needs_review note linked to the capture", async () => {
		(parse as Mock).mockResolvedValue({ ok: false, reason: "failed", raw: "ligar pro médico" });

		const record = await capture(sb, RAW);

		expect(createNeedsReviewNote).toHaveBeenCalledWith(sb, {
			body: "ligar pro médico",
			origin_capture_id: "cap-1",
			reason: "parser_failed",
		});
		expect(record.outcome).toEqual({
			kind: "needs_review",
			noteId: "review-1",
			reason: "parser_failed",
		});
		expect(markParsed).toHaveBeenCalledWith(sb, "cap-1");
		expect(runActions).not.toHaveBeenCalled();
	});

	it("preserves an empty parse as a plain note (not needs_review)", async () => {
		(parse as Mock).mockResolvedValue({ ok: false, reason: "empty", raw: "hmm" });

		await capture(sb, RAW);

		expect(createNeedsReviewNote).not.toHaveBeenCalled();
		expect(runActions).toHaveBeenCalledWith(
			sb,
			[{ action: "create_note", body: "ligar pro médico", source_type: "own_thought" }],
			expect.anything(),
		);
	});
});

// The containment property: once the raw row is persisted, capture() must never
// reject — no matter which downstream seam throws (rather than typed-failing).
describe("capture containment (single no-throw boundary)", () => {
	it("resolves when parse() REJECTS instead of returning a typed failure", async () => {
		(parse as Mock).mockRejectedValue(new Error("boom"));

		const record = await capture(sb, RAW);

		// Contained to a last-resort needs_review note.
		expect(record.outcome).toEqual({
			kind: "needs_review",
			noteId: "review-1",
			reason: "capture_error",
		});
	});

	it("resolves when date-context resolution (getAppTimezone) throws", async () => {
		(getAppTimezone as Mock).mockRejectedValueOnce(new Error("no settings"));

		await expect(capture(sb, RAW)).resolves.toMatchObject({
			outcome: { kind: "needs_review", reason: "capture_error" },
		});
	});

	it("resolves and leaves the row raw when even the fallback note insert fails", async () => {
		(parse as Mock).mockResolvedValue({ ok: false, reason: "failed", raw: "x" });
		(createNeedsReviewNote as Mock).mockRejectedValue(new Error("db down"));

		const record = await capture(sb, RAW);

		expect(record).toEqual({
			capturedId: "cap-1",
			status: "raw",
			outcome: { kind: "recorded_only" },
		});
	});

	it("resolves when markParsed REJECTS", async () => {
		(parse as Mock).mockResolvedValue({
			ok: true,
			actions: [{ action: "create_task", title: "x" }],
		});
		(runActions as Mock).mockResolvedValue([]);
		(markParsed as Mock).mockRejectedValueOnce(new Error("network"));

		// Even a rejecting terminal marker cannot make capture() throw.
		await expect(capture(sb, RAW)).resolves.toBeDefined();
	});
});
