import { describe, expect, it } from "vitest";
import { deriveReceipt } from "@/lib/capture/receipt";
import type { CapturedRecord } from "@/lib/services/capture";

function record(outcome: CapturedRecord["outcome"]): CapturedRecord {
	return { capturedId: "cap-1", status: "parsed", outcome };
}

describe("deriveReceipt — executed", () => {
	it("summarises created tasks and notes", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_task", ok: true, entity: { table: "tasks", id: "t1" } },
					{ action: "create_task", ok: true, entity: { table: "tasks", id: "t2" } },
					{ action: "create_note", ok: true, entity: { table: "notes", id: "n1" } },
				],
			}),
		);
		expect(receipt.tone).toBe("executed");
		expect(receipt.title).toBe("Captured");
		expect(receipt.lines).toEqual(["2 tasks added.", "1 note saved."]);
	});

	it("reports degraded actions as flagged for review", () => {
		const receipt = deriveReceipt(
			record({
				kind: "executed",
				results: [
					{ action: "create_task", ok: true, entity: { table: "tasks", id: "t1" } },
					{ action: "needs_review", ok: false, reason: "unknown project", noteId: "r1" },
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
				results: [{ action: "needs_review", ok: false, reason: "no service", noteId: "r1" }],
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
			record({ kind: "needs_review", noteId: "r1", reason: "parser_failed" }),
		);
		expect(receipt.tone).toBe("needs_review");
		expect(receipt.title).toBe("Kept for review");
		expect(receipt.lines[0]).toBe("We couldn't file this automatically.");
	});

	it("tells the user when the parser is offline", () => {
		const receipt = deriveReceipt(
			record({ kind: "needs_review", noteId: "r1", reason: "parser_unavailable" }),
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
