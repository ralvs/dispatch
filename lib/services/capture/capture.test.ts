// Stubbed on purpose: these cases inject a failure into one seam (settings,
// the fallback note, markParsed) that a real database cannot produce on cue.
// Everything else about capture() runs for real in capture.int.test.ts.
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
	vi.spyOn(console, "info").mockImplementation(() => {});
});

// The containment property: once the raw row is persisted, capture() must never
// reject — no matter which downstream seam throws (rather than typed-failing).
describe("capture containment (single no-throw boundary)", () => {
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
