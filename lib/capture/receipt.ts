import type { ActionResult, CapturedRecord } from "@/lib/services/capture";

// ─────────────────────────────────────────────────────────────────────────
// Receipt derivation — the pure view-model shown after a capture lands. Maps
// CapturedRecord.outcome (docs/adr/0008) to English the owner reads: what was
// created (executed), that it was kept for review, or that the raw input is
// safely recorded and will be surfaced.
//
// Two readers now: the palette renders it, and POST /api/capture returns
// `lines` joined as `summary` so the Siri Shortcut can speak the outcome back
// to a wrist that never looks at a screen (docs/adr/0022).
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

type EntityTable = Extract<ActionResult, { ok: true }>["entity"]["table"];

// Every table the executor can write, in the order they are reported. Each
// kind names itself: this used to be "tasks, and everything else is a note",
// which pre-dated events joining the vocabulary (docs/adr/0023) and would tell
// you "1 note saved" after booking a lunch. Now that the Shortcut reads this
// aloud, a wrong noun is the whole message.
const ENTITY_COPY: Record<EntityTable, { one: string; many: string; verb: string }> = {
	tasks: { one: "task", many: "tasks", verb: "added" },
	calendar_events: { one: "event", many: "events", verb: "added" },
	notes: { one: "note", many: "notes", verb: "saved" },
	quotes: { one: "quote", many: "quotes", verb: "saved" },
	journal_entries: { one: "journal entry", many: "journal entries", verb: "saved" },
};

const ENTITY_ORDER = Object.keys(ENTITY_COPY) as EntityTable[];

function plural(n: number, singular: string): string {
	return `${n} ${singular}${n === 1 ? "" : "s"}`;
}

// The degrade reasons carry a slightly different reassurance. Both point at
// Notes: a degraded capture becomes a needs_review NOTE holding the verbatim
// text (docs/adr/0008), never a task in the Inbox — which is what this copy
// used to claim.
function reviewLines(reason: string): string[] {
	if (reason === "parser_unavailable") {
		return ["Automatic sorting is offline right now.", "Kept in Notes, word for word."];
	}
	return ["We couldn't file this automatically.", "Kept in Notes to sort out."];
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
	const counts = new Map<EntityTable, number>();
	let flagged = 0;
	for (const result of outcome.results) {
		if (result.ok) {
			counts.set(result.entity.table, (counts.get(result.entity.table) ?? 0) + 1);
		} else {
			flagged += 1;
		}
	}

	const lines: string[] = [];
	let created = 0;
	for (const table of ENTITY_ORDER) {
		const n = counts.get(table) ?? 0;
		if (n === 0) continue;
		created += n;
		const copy = ENTITY_COPY[table];
		lines.push(`${n} ${n === 1 ? copy.one : copy.many} ${copy.verb}.`);
	}
	if (flagged > 0) lines.push(`${plural(flagged, "item")} flagged for review.`);
	if (lines.length === 0) lines.push("Saved. Nothing needed scheduling.");

	const title = created > 0 ? "Captured" : flagged > 0 ? "Kept for review" : "Saved";
	return { tone: "executed", title, lines };
}
