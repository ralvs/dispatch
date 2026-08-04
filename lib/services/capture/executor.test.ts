import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { CaptureAction } from "@/lib/schemas/capture";
import { runActions } from "@/lib/services/capture/executor";

vi.mock("@/lib/services/tasks", () => ({ createTask: vi.fn() }));
vi.mock("@/lib/services/notes", () => ({ createNote: vi.fn(), createNeedsReviewNote: vi.fn() }));
vi.mock("@/lib/services/quotes", () => ({ createQuote: vi.fn() }));
vi.mock("@/lib/services/journal", () => ({ createEntry: vi.fn() }));
vi.mock("@/lib/services/calendar", () => ({ createEventHere: vi.fn() }));
vi.mock("@/lib/caldav/client", () => ({ createCaldavClient: vi.fn(async () => ({})) }));
vi.mock("@/lib/services/notifications", () => ({ recordNotification: vi.fn() }));
vi.mock("@/lib/env", () => ({ isCaldavConfigured: vi.fn(() => true) }));
vi.mock("@/lib/services/mentions", () => ({ syncTaskMentionsFromText: vi.fn() }));

import { isCaldavConfigured } from "@/lib/env";
import { createEventHere } from "@/lib/services/calendar";
import { createEntry } from "@/lib/services/journal";
import { syncTaskMentionsFromText } from "@/lib/services/mentions";
import { createNeedsReviewNote, createNote } from "@/lib/services/notes";
import { recordNotification } from "@/lib/services/notifications";
import { createQuote } from "@/lib/services/quotes";
import { createTask } from "@/lib/services/tasks";

const sb = {} as SupabaseClient;
const PROV = {
	capturedId: "cap-1",
	transcript: "verbatim text",
	tz: "America/Sao_Paulo",
	routing: {
		domains: [{ id: "dom-home", name: "Home" }],
		projects: [{ id: "proj-reviews", name: "Reviews", domain_id: "dom-home" }],
	},
};

beforeEach(() => {
	vi.clearAllMocks();
	(syncTaskMentionsFromText as Mock).mockResolvedValue(undefined);
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

	it("resolves domain/project routing for create_task", async () => {
		(createTask as Mock).mockResolvedValue({ id: "task-1" });

		const actions: CaptureAction[] = [
			{ action: "create_task", title: "ship it", project: "Reviews" },
		];

		await runActions(sb, actions, PROV);

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				title: "ship it",
				domain_id: "dom-home",
				project_id: "proj-reviews",
				notes: null,
			}),
		);
	});

	it("falls back to Inbox and appends an unresolved mention when routing misses", async () => {
		(createTask as Mock).mockResolvedValue({ id: "task-1" });

		const actions: CaptureAction[] = [
			{ action: "create_task", title: "ship it", project: "Ghost project", notes: "context" },
		];

		await runActions(sb, actions, PROV);

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				domain_id: null,
				project_id: null,
				notes: 'context\n[capture: unresolved project "Ghost project"]',
			}),
		);
	});

	it("passes recurrence_rule and notes through to createTask", async () => {
		(createTask as Mock).mockResolvedValue({ id: "task-1" });

		const actions: CaptureAction[] = [
			{
				action: "create_task",
				title: "water plants",
				notes: "front porch pots",
				recurrence_rule: "weekly",
			},
		];

		await runActions(sb, actions, PROV);

		expect(createTask).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				notes: "front porch pots",
				recurrence_rule: "weekly",
			}),
		);
	});

	it("syncs mentions best-effort after create_task (iron rule #4 via fail:swallow)", async () => {
		(createTask as Mock).mockResolvedValue({ id: "task-9", title: "call @Ana", notes: null });

		const actions: CaptureAction[] = [{ action: "create_task", title: "call @Ana" }];

		const results = await runActions(sb, actions, PROV);

		expect(results[0]).toEqual({
			action: "create_task",
			ok: true,
			entity: { table: "tasks", id: "task-9" },
		});
		expect(syncTaskMentionsFromText).toHaveBeenCalledWith(sb, "task-9", "call @Ana", null, {
			fail: "swallow",
		});
		expect(createNeedsReviewNote).not.toHaveBeenCalled();
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

	it("creates a journal entry for the create_journal_entry verb, defaulting entry_date to today in the app tz", async () => {
		(createEntry as Mock).mockResolvedValue({ id: "entry-1" });

		const actions: CaptureAction[] = [
			{ action: "create_journal_entry", body: "today was a good day" },
		];

		const results = await runActions(sb, actions, PROV);

		expect(results[0]).toEqual({
			action: "create_journal_entry",
			ok: true,
			entity: { table: "journal_entries", id: "entry-1" },
		});
		expect(createEntry).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({
				transcription_text: "today was a good day",
				source: "typed",
			}),
		);
	});

	it("degrades create_journal_entry to a linked needs_review note when the insert fails", async () => {
		(createEntry as Mock).mockRejectedValue(new Error("db down"));
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-4" });

		const actions: CaptureAction[] = [{ action: "create_journal_entry", body: "diary text" }];

		const results = await runActions(sb, actions, PROV);

		expect(results[0]).toMatchObject({
			action: "create_journal_entry",
			ok: false,
			noteId: "review-4",
		});
		expect(createNeedsReviewNote).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ body: "verbatim text", origin_capture_id: "cap-1" }),
		);
	});
});

describe("create_event", () => {
	const LUNCH: CaptureAction = {
		action: "create_event",
		title: "Almoço com a Ana",
		start_date: "2026-07-30",
		start_time: "12:00",
		end_time: "13:00",
		location: "Vila Madalena",
	};

	it("converts the app-timezone wall clock to UTC instants", async () => {
		(createEventHere as Mock).mockResolvedValue({ id: "evt-1", title: "Almoço com a Ana" });

		const results = await runActions(sb, [LUNCH], PROV);

		// America/Sao_Paulo is UTC-3, so noon local is 15:00Z.
		expect(createEventHere).toHaveBeenCalledWith(
			sb,
			expect.anything(),
			expect.objectContaining({
				title: "Almoço com a Ana",
				startUtc: "2026-07-30T15:00:00.000Z",
				endUtc: "2026-07-30T16:00:00.000Z",
				location: "Vila Madalena",
			}),
		);
		expect(results[0]).toEqual({
			action: "create_event",
			ok: true,
			entity: { table: "calendar_events", id: "evt-1" },
		});
	});

	it("writes a ledger row for the external calendar write", async () => {
		(createEventHere as Mock).mockResolvedValue({ id: "evt-2", title: "Standup" });

		await runActions(sb, [LUNCH], PROV);

		expect(recordNotification).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ type: "capture.event", source_ref: "evt-2" }),
		);
	});

	it("still resolves when only the ledger row fails", async () => {
		(createEventHere as Mock).mockResolvedValue({ id: "evt-3", title: "Call" });
		(recordNotification as Mock).mockRejectedValue(new Error("ledger down"));

		const results = await runActions(sb, [LUNCH], PROV);

		expect(results[0]).toMatchObject({ ok: true, entity: { id: "evt-3" } });
		expect(createNeedsReviewNote).not.toHaveBeenCalled();
	});

	it("degrades to a needs_review note when CalDAV is not configured", async () => {
		(isCaldavConfigured as Mock).mockReturnValueOnce(false);
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-5" });

		const results = await runActions(sb, [LUNCH], PROV);

		expect(createEventHere).not.toHaveBeenCalled();
		expect(results[0]).toMatchObject({
			action: "create_event",
			ok: false,
			noteId: "review-5",
		});
	});

	it("degrades rather than pushing an event that ends before it starts", async () => {
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-6" });

		const results = await runActions(
			sb,
			[{ ...LUNCH, start_time: "14:00", end_time: "13:00" }],
			PROV,
		);

		expect(createEventHere).not.toHaveBeenCalled();
		expect(results[0]).toMatchObject({ action: "create_event", ok: false, noteId: "review-6" });
	});

	it("degrades when the CalDAV push itself fails, keeping the transcript", async () => {
		(createEventHere as Mock).mockRejectedValue(new Error("iCloud unreachable"));
		(createNeedsReviewNote as Mock).mockResolvedValue({ id: "review-7" });

		const results = await runActions(sb, [LUNCH], PROV);

		expect(results[0]).toMatchObject({ action: "create_event", ok: false, noteId: "review-7" });
		expect(createNeedsReviewNote).toHaveBeenCalledWith(
			sb,
			expect.objectContaining({ body: "verbatim text", origin_capture_id: "cap-1" }),
		);
	});
});
