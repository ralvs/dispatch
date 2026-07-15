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
//   1. persist the raw input FIRST (the only step allowed to throw)
//   2. parse it (typed fallback — never throws)
//   3. execute the actions (per-action isolation — never throws)
//   4. mark the capture parsed (best-effort)
//
// Any failure degrades to a needs_review note rather than dropping input.
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
	| { action: string; ok: true; entity: { table: "tasks" | "notes"; id: string } }
	| { action: string; ok: false; reason: string; noteId: string };

export type DegradeReason = "parser_unavailable" | "parser_failed";

export type CapturedRecord = {
	capturedId: string;
	status: "parsed";
	outcome:
		| { kind: "executed"; results: ActionResult[] }
		| { kind: "needs_review"; noteId: string; reason: DegradeReason };
};

export async function capture(sb: SupabaseClient, raw: CaptureInput): Promise<CapturedRecord> {
	// 1. Durability point — the only throw in the pipeline.
	const capturedId = await persistRaw(sb, raw);

	// 2. Parse (typed fallback). Relative dates resolve against the app tz.
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

	// 3. Execute. "empty" (nothing actionable) preserves the raw text as a plain
	// note — needs_review=false, since the parser succeeded and simply found no
	// structured action.
	const actions: CaptureAction[] = parsed.ok
		? parsed.actions
		: [{ action: "create_note", body: raw.text, source_type: "own_thought" }];
	const results = await runActions(sb, actions, { capturedId, transcript: raw.text });

	// 4. Terminal marker (best-effort).
	await markParsed(sb, capturedId);
	return { capturedId, status: "parsed", outcome: { kind: "executed", results } };
}
