import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { CaptureAction } from "@/lib/schemas/capture";
import { runActions } from "@/lib/services/capture/executor";

vi.mock("@/lib/services/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/services/notes", () => ({ createNote: vi.fn(), createNeedsReviewNote: vi.fn() }));
vi.mock("@/lib/services/quotes", () => ({ createQuote: vi.fn() }));

import { createNeedsReviewNote, createNote } from "@/lib/services/notes";
import { createQuote } from "@/lib/services/quotes";
import { createTask } from "@/lib/services/tasks";

const sb = {} as SupabaseClient;
const PROV = { capturedId: "cap-1", transcript: "verbatim text" };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("runActions", () => {
	it("isolates a failing action so its siblings still land", async () => {
		(createTask as Mock)
			.mockResolvedValueOnce({ id: "task-1" }) // first create_task ok
			.mockRejectedValueOnce(new Error("db down")); // second create_task fails
		(createNote as Mock).mockResolvedValue({ id: "note-1" });
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-1" });

		const actions: CaptureAction[] = [
			{ action: "create_task", title: "one" },
			{ action: "create_task", title: "two" },
			{ action: "create_note", body: "three" },
		];

		const results = await runActions(sb, actions, PROV);

		expect(results).toHaveLength(3);
		expect(results[0]).toEqual({
			action: "create_task",
			ok: true,
			entity: { table: "tasks", id: "task-1" },
		});
		expect(results[1]).toMatchObject({ action: "create_task", ok: false, noteId: "review-1" });
		expect(results[2]).toEqual({
			action: "create_note",
			ok: true,
			entity: { table: "notes", id: "note-1" },
		});
		// The failing action degraded to a needs_review note linked to the capture.
		expect(createNeedsReviewNote).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ body: "verbatim text", origin_capture_id: "cap-1" }),
		);
	});

	it("turns the parser's needs_review verb into a linked note", async () => {
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-2" });

		const results = await runActions(
			sb,
			[{ action: "needs_review", reason: "unknown project Foo", proposed_kind: "create_project" }],
			PROV,
		);

		expect(results[0]).toMatchObject({ action: "needs_review", ok: false, noteId: "review-2" });
		expect(createNeedsReviewNote).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ proposed_kind: "create_project", origin_capture_id: "cap-1" }),
		);
	});

	it("creates a quote for the create_quote verb", async () => {
		(createQuote as Mock).mockResolvedValue({ id: "quote-1" });

		const actions: CaptureAction[] = [{ action: "create_quote", text: "stay hungry" }];

		const results = await runActions(sb, actions, PROV);

		expect(results[0]).toEqual({
			action: "create_quote",
			ok: true,
			entity: { table: "quotes", id: "quote-1" },
		});
	});

	it("degrades create_quote to a linked needs_review note when the insert fails", async () => {
		(createQuote as Mock).mockRejectedValue(new Error("db down"));
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-3" });

		const actions: CaptureAction[] = [{ action: "create_quote", text: "stay hungry" }];

		const results = await runActions(sb, actions, PROV);

		expect(results[0]).toMatchObject({ action: "create_quote", ok: false, noteId: "review-3" });
		expect(createNeedsReviewNote).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ body: "verbatim text", origin_capture_id: "cap-1" }),
		);
	});
});
