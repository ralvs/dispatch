import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nowUtc } from "@/lib/dates";
import { markParsed } from "@/lib/services/capture/store";
import { unwrap } from "@/lib/services/errors";
import { createNeedsReviewNote } from "@/lib/services/notes";

// ─────────────────────────────────────────────────────────────────────────
// Reconciliation sweep (docs/adr/0008). Any captured_data row stuck at
// processed_status='raw' past the threshold is an orphan — the pipeline
// crashed before terminating. The sweep DEGRADES orphans to a needs_review
// note and marks them parsed; it never replays the pipeline (replay would
// re-run non-idempotent executes). Dedupe is on notes.origin_capture_id: a
// row that already has a linked note only gets its terminal marker.
// ─────────────────────────────────────────────────────────────────────────

/** Orphan threshold from ADR-0008 (~10 min). */
export const SWEEP_THRESHOLD_MINUTES = 10;

export type SweepResult = {
	/** Orphans degraded to a fresh needs_review note. */
	swept: string[];
	/** Orphans that already had a linked note — only markParsed was applied. */
	reconciled: string[];
};

type OrphanRow = { id: string; payload: unknown };

/** Best-effort readable body for the fallback note. */
function orphanBody(payload: unknown): string {
	if (payload && typeof payload === "object") {
		const transcript = (payload as { transcript?: unknown }).transcript;
		if (typeof transcript === "string" && transcript.trim() !== "") return transcript;
	}
	return JSON.stringify(payload ?? null);
}

export async function sweepRawCaptures(
	sb: SupabaseClient,
	opts: { olderThanMinutes?: number; nowMs?: number } = {},
): Promise<SweepResult> {
	const minutes = opts.olderThanMinutes ?? SWEEP_THRESHOLD_MINUTES;
	const cutoffUtc = nowUtc((opts.nowMs ?? Date.now()) - minutes * 60_000);

	const orphans = (unwrap(
		await sb
			.from("captured_data")
			.select("id, payload")
			.eq("processed_status", "raw")
			.lt("created_at", cutoffUtc),
	) ?? []) as OrphanRow[];

	if (orphans.length === 0) return { swept: [], reconciled: [] };

	// Dedupe: which orphans already have a linked note (crash after the note
	// write but before markParsed)? Those only need the terminal marker.
	const linked = (unwrap(
		await sb
			.from("notes")
			.select("origin_capture_id")
			.in(
				"origin_capture_id",
				orphans.map((o) => o.id),
			),
	) ?? []) as { origin_capture_id: string | null }[];
	const alreadyLinked = new Set(linked.map((n) => n.origin_capture_id));

	const swept: string[] = [];
	const reconciled: string[] = [];
	for (const orphan of orphans) {
		if (!alreadyLinked.has(orphan.id)) {
			await createNeedsReviewNote(sb, {
				body: orphanBody(orphan.payload),
				origin_capture_id: orphan.id,
				reason: "sweep_orphan",
			});
			swept.push(orphan.id);
		} else {
			reconciled.push(orphan.id);
		}
		await markParsed(sb, orphan.id);
	}
	return { swept, reconciled };
}
