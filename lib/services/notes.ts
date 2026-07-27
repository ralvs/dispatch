import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import {
	type CreateNoteSchema,
	NOTE_LIST_SELECT,
	NOTE_SELECT,
	type NoteListRow,
	type NoteRow,
	type UpdateNoteSchema,
} from "@/lib/schemas/note";
import { unwrap, unwrapCount } from "@/lib/services/errors";

export type { NoteListRow, NoteRow };

// shape intentionally differs from CreateNoteSchema: source_type there has a
// Zod `.default("own_thought")`, so z.infer's output type makes it required
// — but callers here (e.g. the capture executor) construct this object
// directly, without going through CreateNoteSchema.parse(), and rely on
// source_type being optional (createNote below applies the same fallback
// manually). Keeping the hand-written, all-optional-except-body shape.
export type CreateNoteInput = {
	body: string;
	title?: string | null;
	source_type?: z.infer<typeof CreateNoteSchema>["source_type"];
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
	return data as unknown as NoteRow;
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
	let q = sb
		.from("notes")
		.select(NOTE_LIST_SELECT)
		.order("pinned_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });
	if (filters.needsReview !== undefined) q = q.eq("needs_review", filters.needsReview);
	const data = unwrap(await q);
	return (data ?? []) as unknown as NoteListRow[];
}

export async function getNote(sb: SupabaseClient, id: string): Promise<NoteListRow | null> {
	const data = unwrap(await sb.from("notes").select(NOTE_LIST_SELECT).eq("id", id).maybeSingle());
	return (data as unknown as NoteListRow | null) ?? null;
}

export async function updateNote(
	sb: SupabaseClient,
	id: string,
	patch: z.infer<typeof UpdateNoteSchema>,
): Promise<void> {
	unwrap(await sb.from("notes").update(patch).eq("id", id));
}

/** Flips a note pinned<->unpinned. The timestamp (not a bool) fixes pin order — most-recently-pinned first. */
export async function togglePin(sb: SupabaseClient, id: string): Promise<void> {
	const data = unwrap(await sb.from("notes").select("pinned_at").eq("id", id).maybeSingle());
	const row = data as { pinned_at: string | null } | null;
	if (!row) throw new Error("Note not found");
	const next = row.pinned_at ? null : nowUtc();
	unwrap(await sb.from("notes").update({ pinned_at: next }).eq("id", id));
}

/** Resolve the never-lose safety net (iron rule #4) without touching the body. */
export async function resolveNeedsReview(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").update({ needs_review: false }).eq("id", id));
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").delete().eq("id", id));
}

/** Minimal id/title/body projection for wikilink resolution — all notes, no filtering. */
export async function listNoteTitles(
	sb: SupabaseClient,
): Promise<Array<{ id: string; title: string | null; body: string }>> {
	const data = unwrap(
		await sb.from("notes").select("id, title, body").order("created_at", { ascending: false }),
	);
	return (data ?? []) as unknown as Array<{ id: string; title: string | null; body: string }>;
}

export async function countNeedsReview(sb: SupabaseClient): Promise<number> {
	return unwrapCount(
		await sb.from("notes").select("*", { count: "exact", head: true }).eq("needs_review", true),
	);
}
