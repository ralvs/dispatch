import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaptureInput } from "@/lib/services/capture";
import { unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// The captured_data ledger: persist-first durability for iron rule #4.
//
// Palette captures land as source='manual', type='voice_capture', with the
// transcript + `via` verbatim in the payload (the captured_data.source CHECK
// has no 'voice'/'text' values — those are the transcript origin, not the
// firehose source). The insert is the durability point: once it returns an id
// the capture cannot be lost. capture() owns only raw -> parsed; 'displayed'
// and 'archived' belong to the feed read-layer.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Persist the raw input FIRST, before any transcribe/parse. Returns the new
 * captured_data id. This is the ONLY step in the pipeline allowed to throw —
 * if it fails, nothing was captured and the caller still holds the text.
 */
export async function persistRaw(sb: SupabaseClient, input: CaptureInput): Promise<string> {
	const data = unwrap(
		await sb
			.from("captured_data")
			.insert({
				source: "manual",
				type: "voice_capture",
				payload: {
					transcript: input.text,
					via: input.via,
					client_time: input.clientTime ?? null,
				},
				processed_status: "raw",
			})
			.select("id")
			.single(),
	);
	return (data as { id: string }).id;
}

/**
 * Mark a capture terminal (raw -> parsed) once processing produced a definite
 * outcome. Best-effort by design: a failure here must NOT throw into the
 * capture path, so it is swallowed — the row stays 'raw' and the reconciliation
 * sweep (docs/adr/0008) will pick it up. The raw content is already durable.
 */
export async function markParsed(sb: SupabaseClient, id: string): Promise<void> {
	try {
		await sb.from("captured_data").update({ processed_status: "parsed" }).eq("id", id);
	} catch {
		// A rejected request (network error) or an error result both leave the row
		// 'raw' for the sweep. Swallowed so this can never escape into capture().
	}
}
