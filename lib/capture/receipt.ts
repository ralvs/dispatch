import type { CapturedRecord } from "@/lib/services/capture";

// ─────────────────────────────────────────────────────────────────────────
// Receipt derivation — the pure view-model the palette shows after a capture
// lands. Maps CapturedRecord.outcome (docs/adr/0008) to English UI chrome the
// owner reads: what was created (executed), that it was kept for review, or
// that the raw input is safely recorded and will be surfaced.
//
// Kept free of React and `server-only` so it is unit-testable in the node
// vitest env and safe to import into the client bundle (the CapturedRecord
// import is type-only and erased at build time).
// ─────────────────────────────────────────────────────────────────────────

export type ReceiptTone = "executed" | "needs_review" | "recorded_only";

export type CaptureReceipt = {
	tone: ReceiptTone;
	title: string;
	// One or more short English sentences describing what happened.
	lines: string[];
};

function plural(n: number, singular: string): string {
	return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

// The degrade reasons carry a slightly different reassurance.
function reviewLines(reason: string): string[] {
	if (reason === "parser_unavailable") {
		return ["Automatic sorting is offline right now.", "Saved to your Inbox to file by hand."];
	}
	return ["We couldn't file this automatically.", "Saved to your Inbox to sort out."];
}

export function deriveReceipt(record: CapturedRecord): CaptureReceipt {
	const { outcome } = record;

	if (outcome.kind === "needs_review") {
		return { tone: "needs_review", title: "Kept for review", lines: reviewLines(outcome.reason) };
	}

	if (outcome.kind === "recorded_only") {
		return {
			tone: "recorded_only",
			title: "Saved",
			lines: ["Your words are safely recorded.", "They'll be surfaced shortly."],
		};
	}

	// executed — summarise the actions the executor ran.
	let tasks = 0;
	let notes = 0;
	let flagged = 0;
	for (const result of outcome.results) {
		if (!result.ok) {
			flagged += 1;
		} else if (result.entity.table === "tasks") {
			tasks += 1;
		} else {
			notes += 1;
		}
	}

	const lines: string[] = [];
	if (tasks > 0) lines.push(`${plural(tasks, "task")} added.`);
	if (notes > 0) lines.push(`${plural(notes, "note")} saved.`);
	if (flagged > 0) lines.push(`${plural(flagged, "item")} flagged for review.`);
	if (lines.length === 0) lines.push("Saved. Nothing needed scheduling.");

	const created = tasks + notes;
	const title = created > 0 ? "Captured" : flagged > 0 ? "Kept for review" : "Saved";
	return { tone: "executed", title, lines };
}
