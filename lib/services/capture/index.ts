import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "@/lib/ai/parser";
import type { CaptureAction } from "@/lib/schemas/capture";
import { recordNeedsReview } from "@/lib/services/capture/degrade";
import { runActions } from "@/lib/services/capture/executor";
import { loadCaptureContext } from "@/lib/services/capture/resolve";
import { markParsed, persistRaw } from "@/lib/services/capture/store";
import type { JournalEntryRow } from "@/lib/services/journal";
import type { NoteListRow } from "@/lib/services/notes";
import type { QuoteRow } from "@/lib/services/quotes";
import type { TaskRow } from "@/lib/services/tasks";

// ─────────────────────────────────────────────────────────────────────────
// The capture module (docs/adr/0008). One deep function, capture(sb, raw),
// built around the never-lose guarantee (iron rule #4):
//
//   1. persist the raw input FIRST — the ONLY step allowed to throw.
//   2. everything after runs inside a single no-throw boundary: parse/execute
//      and the terminal marker. Any failure best-effort degrades to a linked
//      needs_review note; if even that write fails, the row is left 'raw' for
//      the reconciliation sweep and capture RESOLVES with a `recorded_only`
//      outcome.
//
// Once the raw row exists, capture() never rejects. The containment is
// structural (the try/catch below), not incidental to each seam — so no
// downstream failure (env validation, date math, parser, note insert,
// markParsed) can escape and lose the caller's receipt.
//
// Capture is text-only (docs/adr/0017). The module takes `sb` first (iron
// rule #3) and never builds a client.
// ─────────────────────────────────────────────────────────────────────────

export type CaptureInput = {
	kind: "transcript";
	text: string;
	via: "voice" | "text";
	clientTime?: string;
	// captured_data.source — where the firehose row came from. Palette captures
	// omit it ('manual'); external surfaces (Phase 7) say who they are.
	source?: "manual" | "webhook" | "watch";
};

/**
 * What one parsed action wrote. A row the entity store holds comes back whole
 * (`row`), so the palette can confirm it without a page render
 * (docs/adr/0069); a calendar event is not one of them.
 */
export type CaptureEntity =
	| { table: "tasks"; id: string; row: TaskRow }
	| { table: "notes"; id: string; row: NoteListRow }
	| { table: "quotes"; id: string; row: QuoteRow }
	| { table: "journal_entries"; id: string; row: JournalEntryRow }
	| { table: "calendar_events"; id: string };

/** One action's outcome. A failed action degraded to `note`; null when even that write failed. */
export type CaptureActionResult =
	| { action: string; ok: true; entity: CaptureEntity }
	| { action: string; ok: false; reason: string; noteId: string; note: NoteListRow | null };

export type DegradeReason = "parser_unavailable" | "parser_failed" | "capture_error";

export type CapturedRecord = {
	capturedId: string;
	// 'parsed' once processing reached a definite outcome; 'raw' only in the
	// last-resort case where even the fallback note could not be written.
	status: "raw" | "parsed";
	outcome:
		| { kind: "executed"; results: CaptureActionResult[] }
		| { kind: "needs_review"; noteId: string; note: NoteListRow; reason: DegradeReason }
		// Raw is durable but processing failed AND the fallback note write failed.
		// The row stays 'raw' for the sweep; nothing is lost.
		| { kind: "recorded_only" };
};

export async function capture(sb: SupabaseClient, raw: CaptureInput): Promise<CapturedRecord> {
	const t0 = performance.now();
	// Persist and context load are independent. Persist is still the only
	// throw the caller sees — a context failure is contained below.
	const [persistResult, contextResult] = await Promise.allSettled([
		persistRaw(sb, raw),
		loadCaptureContext(sb),
	]);
	if (persistResult.status === "rejected") throw persistResult.reason;
	const capturedId = persistResult.value;

	try {
		if (contextResult.status === "rejected") throw contextResult.reason;
		return await process(sb, capturedId, raw, contextResult.value, t0);
	} catch {
		// No-throw boundary. Processing failed after the raw row was persisted;
		// best-effort leave a linked needs_review note so the content is visible.
		return await lastResort(sb, capturedId, raw);
	}
}

type LoadedContext = Awaited<ReturnType<typeof loadCaptureContext>>;

/** The happy path. May throw anything; capture()'s boundary contains it. */
async function process(
	sb: SupabaseClient,
	capturedId: string,
	raw: CaptureInput,
	loaded: LoadedContext,
	t0: number,
): Promise<CapturedRecord> {
	const tContext = performance.now();
	const { tz, routing, ctx } = loaded;
	const parsed = await parse(raw.text, ctx);
	const tParse = performance.now();

	// A hard parser failure degrades the whole capture to one needs_review note,
	// storing the transcript verbatim (no model in the loop).
	if (!parsed.ok && parsed.reason !== "empty") {
		const reason: DegradeReason =
			parsed.reason === "unavailable" ? "parser_unavailable" : "parser_failed";
		const { noteId, note } = await recordNeedsReview(sb, {
			transcript: raw.text,
			capturedId,
			reason,
			mark: true,
		});
		console.info("⏱ capture", {
			id: capturedId,
			context: Math.round(tContext - t0),
			parse: Math.round(tParse - tContext),
			outcome: reason,
			total: Math.round(performance.now() - t0),
		});
		return {
			capturedId,
			status: "parsed",
			outcome: { kind: "needs_review", noteId, note, reason },
		};
	}

	// Execute. "empty" (nothing actionable) preserves the raw text as a plain
	// note — needs_review=false, since the parser succeeded and simply found no
	// structured action.
	const actions: CaptureAction[] = parsed.ok
		? parsed.actions
		: [{ action: "create_note", body: raw.text, source_type: "own_thought" }];
	const results = await runActions(sb, actions, { capturedId, transcript: raw.text, tz, routing });
	const tExec = performance.now();

	// Terminal marker (best-effort — markParsed never throws).
	await markParsed(sb, capturedId);
	console.info("⏱ capture", {
		id: capturedId,
		context: Math.round(tContext - t0),
		parse: Math.round(tParse - tContext),
		execute: Math.round(tExec - tParse),
		total: Math.round(performance.now() - t0),
	});
	return { capturedId, status: "parsed", outcome: { kind: "executed", results } };
}

/**
 * Reached only when `process` threw. Try once more to record a needs_review
 * note; if that also fails, resolve with `recorded_only` and leave the row
 * 'raw' for the reconciliation sweep. Never throws.
 */
async function lastResort(
	sb: SupabaseClient,
	capturedId: string,
	raw: CaptureInput,
): Promise<CapturedRecord> {
	try {
		const { noteId, note } = await recordNeedsReview(sb, {
			transcript: raw.text,
			capturedId,
			reason: "capture_error",
			mark: true,
		});
		return {
			capturedId,
			status: "parsed",
			outcome: { kind: "needs_review", noteId, note, reason: "capture_error" },
		};
	} catch {
		return { capturedId, status: "raw", outcome: { kind: "recorded_only" } };
	}
}

/**
 * The rows a capture wrote that the entity store holds, by kind — what the
 * palette confirms into the store. Null when the capture also wrote something
 * the store does not hold (a calendar event): then the page has to render
 * again to show it, and confirming half the capture buys nothing.
 */
export type CaptureRows = {
	task: TaskRow[];
	note: NoteListRow[];
	quote: QuoteRow[];
	journal: JournalEntryRow[];
};

export function capturedRows(record: CapturedRecord): CaptureRows | null {
	const rows: CaptureRows = { task: [], note: [], quote: [], journal: [] };
	const { outcome } = record;
	if (outcome.kind === "needs_review") rows.note.push(outcome.note);
	if (outcome.kind !== "executed") return rows;
	for (const result of outcome.results) {
		if (!result.ok) {
			if (result.note) rows.note.push(result.note);
			continue;
		}
		const { entity } = result;
		switch (entity.table) {
			case "tasks":
				rows.task.push(entity.row);
				break;
			case "notes":
				rows.note.push(entity.row);
				break;
			case "quotes":
				rows.quote.push(entity.row);
				break;
			case "journal_entries":
				rows.journal.push(entity.row);
				break;
			case "calendar_events":
				return null;
		}
	}
	return rows;
}
