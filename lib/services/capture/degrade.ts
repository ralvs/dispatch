import "server-only";
import { markParsed } from "@/lib/services/capture/store";
import { createNeedsReviewNote, type NoteListRow } from "@/lib/services/notes";
import type { SupabaseClient } from "@/lib/supabase/types";

/**
 * The one needs_review write: transcript + origin + reason → note that
 * still has the reason. Optional markParsed for the firehose terminal. The
 * note comes back whole, for the entity store.
 */
export async function recordNeedsReview(
	sb: SupabaseClient,
	input: {
		transcript: string;
		capturedId: string;
		reason: string;
		proposedKind?: string;
		mark?: boolean;
	},
): Promise<{ noteId: string; note: NoteListRow }> {
	const note = await createNeedsReviewNote(sb, {
		body: input.transcript,
		origin_capture_id: input.capturedId,
		reason: input.reason,
		proposed_kind: input.proposedKind,
	});
	if (input.mark) await markParsed(sb, input.capturedId);
	return { noteId: note.id, note };
}
