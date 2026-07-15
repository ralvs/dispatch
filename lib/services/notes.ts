import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteSourceType } from "@/lib/schemas/note";
import { unwrap } from "@/lib/services/errors";

// Columns returned by the write paths. Kept small and explicit — callers of the
// capture pipeline only need the id, but the shape is honest about what a note
// row carries out of an insert.
const NOTE_SELECT =
	"id, title, body, source_type, needs_review, tags, origin_capture_id, created_at";

export type NoteRow = {
	id: string;
	title: string | null;
	body: string;
	source_type: NoteSourceType;
	needs_review: boolean;
	tags: string[];
	origin_capture_id: string | null;
	created_at: string;
};

export type CreateNoteInput = {
	body: string;
	title?: string | null;
	source_type?: NoteSourceType;
	source_reference?: string | null;
	tags?: string[];
	related_project_id?: string | null;
	related_person_id?: string | null;
	related_quote_id?: string | null;
	needs_review?: boolean;
	origin_capture_id?: string | null;
};

/** Create a note. Body is stored verbatim in whatever language it arrived in. */
export async function createNote(sb: SupabaseClient, input: CreateNoteInput): Promise<NoteRow> {
	const data = unwrap(
		await sb
			.from("notes")
			.insert({
				...input,
				source_type: input.source_type ?? "own_thought",
			})
			.select(NOTE_SELECT)
			.single(),
	);
	return data as NoteRow;
}

/**
 * The never-lose safety net (iron rule #4, docs/adr/0008). Persists content the
 * capture pipeline could not confidently place as a `needs_review` note, storing
 * the raw text verbatim and linking back to the originating capture so the
 * reconciliation sweep can dedupe.
 *
 * `reason` explains why it degraded; `proposed_kind` (when the parser guessed at
 * an intent it lacked a service for) is surfaced as an `unhandled:<kind>` tag.
 */
export async function createNeedsReviewNote(
	sb: SupabaseClient,
	input: {
		body: string;
		origin_capture_id?: string | null;
		reason?: string;
		proposed_kind?: string;
		tags?: string[];
	},
): Promise<NoteRow> {
	const tags = [
		"capture:needs_review",
		...(input.proposed_kind ? [`unhandled:${input.proposed_kind}`] : []),
		...(input.tags ?? []),
	];
	return createNote(sb, {
		body: input.body,
		source_type: "own_thought",
		needs_review: true,
		origin_capture_id: input.origin_capture_id ?? null,
		tags,
	});
}
