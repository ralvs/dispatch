import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { NoteSourceType, UpdateNoteSchema } from "@/lib/schemas/note";
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

// Wider read for the notes page/list views — adds the columns the write
// paths above don't need but the UI does (relations, source_reference).
const NOTE_LIST_SELECT = `${NOTE_SELECT}, source_reference, related_project_id, related_person_id, related_quote_id`;

export type NoteListRow = NoteRow & {
	source_reference: string | null;
	related_project_id: string | null;
	related_person_id: string | null;
	related_quote_id: string | null;
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

export async function listNotes(
	sb: SupabaseClient,
	filters: { needsReview?: boolean } = {},
): Promise<NoteListRow[]> {
	let q = sb.from("notes").select(NOTE_LIST_SELECT).order("created_at", { ascending: false });
	if (filters.needsReview) q = q.eq("needs_review", true);
	const data = unwrap(await q);
	return (data ?? []) as unknown as NoteListRow[];
}

export async function getNote(sb: SupabaseClient, id: string): Promise<NoteListRow | null> {
	const data = unwrap(await sb.from("notes").select(NOTE_LIST_SELECT).eq("id", id).maybeSingle());
	return (data as NoteListRow | null) ?? null;
}

export async function updateNote(
	sb: SupabaseClient,
	id: string,
	patch: z.infer<typeof UpdateNoteSchema>,
): Promise<void> {
	unwrap(await sb.from("notes").update(patch).eq("id", id));
}

/** Resolve the never-lose safety net (iron rule #4) without touching the body. */
export async function resolveNeedsReview(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").update({ needs_review: false }).eq("id", id));
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").delete().eq("id", id));
}

export async function countNeedsReview(sb: SupabaseClient): Promise<number> {
	const result = await sb
		.from("notes")
		.select("*", { count: "exact", head: true })
		.eq("needs_review", true);
	unwrap(result);
	return result.count ?? 0;
}
