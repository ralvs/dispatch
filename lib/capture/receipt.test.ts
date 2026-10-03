import { describe, expect, it } from "vitest";
import { deriveReceipt } from "@/lib/capture/receipt";
import type { CapturedRecord, CaptureEntity } from "@/lib/services/capture";
import { journalEntry, note, quote, task } from "@/lib/store/test-fixtures";

/** What the executor reports for each store-held table: the row comes back whole. */
const made = {
	tasks: (id: string): CaptureEntity => ({ table: "tasks", id, row: task({ id }) }),
	notes: (id: string): CaptureEntity => ({ table: "notes", id, row: note({ id }) }),
	quotes: (id: string): CaptureEntity => ({ table: "quotes", id, row: quote({ id }) }),
	journal: (id: string): CaptureEntity => ({
		table: "journal_entries",
		id,
		row: journalEntry({ id }),
	}),
};
const flagged = (id: string) => note({ id, needs_review: true });

function record(outcome: CapturedRecord["outcome"]): CapturedRecord {
	return { capturedId: "cap-1", status: "parsed", outcome };
}

describe("deriveReceipt — executed", () => {
	it("summarises created tasks and notes", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_task", ok: true, entity: made.tasks("t1") },
					{ action: "create_task", ok: true, entity: made.tasks("t2") },
					{ action: "create_note", ok: true, entity: made.notes("n1") },
				],
			}),
		);
		expect(receipt.tone).toBe("executed");
		expect(receipt.title).toBe("Captured");
		expect(receipt.lines).toEqual(["2 tasks added.", "1 note saved."]);
	});

	it("names every entity kind the executor can write, in a stable order", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_quote", ok: true, entity: made.quotes("q1") },
					{
						action: "create_journal_entry",
						ok: true,
						entity: made.journal("j1"),
					},
					{ action: "create_note", ok: true, entity: made.notes("n1") },
					{ action: "create_event", ok: true, entity: { table: "calendar_events", id: "e1" } },
					{ action: "create_task", ok: true, entity: made.tasks("t1") },
				],
			}),
		);
		expect(receipt.lines).toEqual([
			"1 task added.",
			"1 event added.",
			"1 note saved.",
			"1 quote saved.",
			"1 journal entry saved.",
		]);
	});

	it("does not call a booked event a note", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_event", ok: true, entity: { table: "calendar_events", id: "e1" } },
					{ action: "create_event", ok: true, entity: { table: "calendar_events", id: "e2" } },
				],
			}),
		);
		expect(receipt.title).toBe("Captured");
		expect(receipt.lines).toEqual(["2 events added."]);
	});

	it("pluralises journal entries irregularly", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{
						action: "create_journal_entry",
						ok: true,
						entity: made.journal("j1"),
					},
					{
						action: "create_journal_entry",
						ok: true,
						entity: made.journal("j2"),
					},
				],
			}),
		);
		expect(receipt.lines).toEqual(["2 journal entries saved."]);
	});

	it("reports degraded actions as flagged for review", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_task", ok: true, entity: made.tasks("t1") },
					{
						action: "needs_review",
						ok: false,
						reason: "unknown project",
						noteId: "r1",
						note: flagged("r1"),
					},
				],
			}),
		);
		expect(receipt.lines).toEqual(["1 task added.", "1 item flagged for review."]);
		expect(receipt.title).toBe("Captured");
	});

	it("titles a review-only result as kept for review", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{
						action: "needs_review",
						ok: false,
						reason: "no service",
						noteId: "r1",
						note: flagged("r1"),
					},
				],
			}),
		);
		expect(receipt.title).toBe("Kept for review");
		expect(receipt.lines).toEqual(["1 item flagged for review."]);
	});

	it("reassures when nothing structured was produced", () => {
		const receipt = deriveReceipt(record({ kind: "executed", results: [] }));
		expect(receipt.title).toBe("Saved");
		expect(receipt.lines).toEqual(["Saved. Nothing needed scheduling."]);
	});
});

describe("deriveReceipt — degraded outcomes", () => {
	it("maps a parser failure to a review receipt", () => {
		const receipt = deriveReceipt(
			record({ kind: "needs_review", noteId: "r1", note: flagged("r1"), reason: "parser_failed" }),
		);
		expect(receipt.tone).toBe("needs_review");
		expect(receipt.title).toBe("Kept for review");
		expect(receipt.lines[0]).toBe("We couldn't file this automatically.");
	});

	it("tells the user when the parser is offline", () => {
		const receipt = deriveReceipt(
			record({
				kind: "needs_review",
				noteId: "r1",
				note: flagged("r1"),
				reason: "parser_unavailable",
			}),
		);
		expect(receipt.lines[0]).toBe("Automatic sorting is offline right now.");
	});

	it("reassures on recorded_only that nothing was lost", () => {
		const receipt = deriveReceipt(record({ kind: "recorded_only" }));
		expect(receipt.tone).toBe("recorded_only");
		expect(receipt.title).toBe("Saved");
		expect(receipt.lines[0]).toBe("Your words are safely recorded.");
	});
});
