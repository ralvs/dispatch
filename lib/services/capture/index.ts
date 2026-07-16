import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parse } from "@/lib/ai/parser";
import { nowUtc, todayInTz } from "@/lib/dates";
import type { CaptureAction } from "@/lib/schemas/capture";
import { runActions } from "@/lib/services/capture/executor";
import { markParsed, persistRaw } from "@/lib/services/capture/store";
import { createNeedsReviewNote } from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";

// ─────────────────────────────────────────────────────────────────────────
// The capture module (docs/adr/0008). One deep function, capture(sb, raw),
// built around the never-lose guarantee (iron rule #4):
//
//   1. persist the raw input FIRST — the ONLY step allowed to throw.
//   2. everything after runs inside a single no-throw boundary: transcribe/
//      parse/execute and the terminal marker. Any failure best-effort degrades
//      to a linked needs_review note; if even that write fails, the row is left
//      'raw' for the reconciliation sweep and capture RESOLVES with a
//      `recorded_only` outcome.
//
// Once the raw row exists, capture() never rejects. The containment is
// structural (the try/catch below), not incidental to each seam — so no
// downstream failure (env validation, date math, parser, note insert,
// markParsed) can escape and lose the caller's receipt.
//
// v1 handles the transcript kind only; audio/ingest are deferred (ADR-0008),
// hence the module takes `sb` first (iron rule #3) and never builds a client.
// ─────────────────────────────────────────────────────────────────────────

export type CaptureInput = {
	kind: "transcript";
	text: string;
	via: "voice" | "text";
	clientTime?: string;
};

export type ActionResult =
	| {
			action: string;
			ok: true;
			entity: {
				table: "tasks" | "notes" | "quotes" | "journal_entries" | "health_metrics";
				id: string;
			};
	  }
	| { action: string; ok: false; reason: string; noteId: string };

export type DegradeReason = "parser_unavailable" | "parser_failed" | "capture_error";

export type CapturedRecord = {
	capturedId: string;
	// 'parsed' once processing reached a definite outcome; 'raw' only in the
	// last-resort case where even the fallback note could not be written.
	status: "raw" | "parsed";
	outcome:
		| { kind: "executed"; results: ActionResult[] }
		| { kind: "needs_review"; noteId: string; reason: DegradeReason }
		// Raw is durable but processing failed AND the fallback note write failed.
		// The row stays 'raw' for the sweep; nothing is lost.
		| { kind: "recorded_only" };
};

export async function capture(sb: SupabaseClient, raw: CaptureInput): Promise<CapturedRecord> {
	// Durability point — the only throw in the whole module.
	const capturedId = await persistRaw(sb, raw);

	try {
		return await process(sb, capturedId, raw);
	} catch {
		// No-throw boundary. Processing failed after the raw row was persisted;
		// best-effort leave a linked needs_review note so the content is visible.
		return await lastResort(sb, capturedId, raw);
	}
}

/** The happy path. May throw anything; capture()'s boundary contains it. */
async function process(
	sb: SupabaseClient,
	capturedId: string,
	raw: CaptureInput,
): Promise<CapturedRecord> {
	// Parse (typed fallback). Relative dates resolve against the app tz.
	const tz = await getAppTimezone(sb);
	const parsed = await parse(raw.text, { tz, todayIso: todayInTz(tz), nowUtc: nowUtc() });

	// A hard parser failure degrades the whole capture to one needs_review note,
	// storing the transcript verbatim (no model in the loop).
	if (!parsed.ok && parsed.reason !== "empty") {
		const reason: DegradeReason =
			parsed.reason === "unavailable" ? "parser_unavailable" : "parser_failed";
		const note = await createNeedsReviewNote(sb, {
			body: raw.text,
			origin_capture_id: capturedId,
			reason,
		});
		await markParsed(sb, capturedId);
		return {
			capturedId,
			status: "parsed",
			outcome: { kind: "needs_review", noteId: note.id, reason },
		};
	}

	// Execute. "empty" (nothing actionable) preserves the raw text as a plain
	// note — needs_review=false, since the parser succeeded and simply found no
	// structured action.
	const actions: CaptureAction[] = parsed.ok
		? parsed.actions
		: [{ action: "create_note", body: raw.text, source_type: "own_thought" }];
	const results = await runActions(sb, actions, { capturedId, transcript: raw.text, tz });

	// Terminal marker (best-effort — markParsed never throws).
	await markParsed(sb, capturedId);
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
		const note = await createNeedsReviewNote(sb, {
			body: raw.text,
			origin_capture_id: capturedId,
			reason: "capture_error",
		});
		await markParsed(sb, capturedId);
		return {
			capturedId,
			status: "parsed",
			outcome: { kind: "needs_review", noteId: note.id, reason: "capture_error" },
		};
	} catch {
		return { capturedId, status: "raw", outcome: { kind: "recorded_only" } };
	}
}
