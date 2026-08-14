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
import { type GraphFail, syncNoteMentionsFromText } from "@/lib/services/mentions";
import { syncWikilinks } from "@/lib/services/note-links";
import { extractWikilinkIds } from "@/lib/wikilinks";

export type { NoteListRow, NoteRow };

export type NoteWriteOpts = {
	/** Capture swallows graph failures (iron rule #4). Forms throw. Default throw. */
	graphFail?: GraphFail;
};

/** Wikilinks + person mentions derived from note text. */
async function syncNoteGraph(
	sb: SupabaseClient,
	noteId: string,
	body: string,
	fail: GraphFail,
): Promise<void> {
	const run = async () => {
		await syncWikilinks(sb, noteId, extractWikilinkIds(body));
		await syncNoteMentionsFromText(sb, noteId, body, { fail: "throw" });
	};
	if (fail === "swallow") {
		try {
			await run();
		} catch {
			// Never lose a capture over graph reconcile.
		}
		return;
	}
	await run();
}

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
export async function createNote(
	sb: SupabaseClient,
	input: CreateNoteInput,
	opts: NoteWriteOpts = {},
): Promise<NoteRow> {
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
	const note = data as unknown as NoteRow;
	// Text write owns wikilinks + person graph — callers must not post-sync.
	await syncNoteGraph(sb, note.id, input.body, opts.graphFail ?? "throw");
	return note;
}

/**
 * The never-lose safety net (iron rule #4, docs/adr/0008). Persists content the
 * capture pipeline could not confidently place as a `needs_review` note, storing
 * the raw text verbatim and linking back to the originating capture so the
 * reconciliation sweep can dedupe.
 *
 * `reason` is stored as a `reason:` tag (known tokens as-is; freeform
 * executor messages collapse to `reason:execute_failed`). `proposed_kind`
 * (when the parser guessed at an intent it lacked a service for) is an
 * `unhandled:<kind>` tag. Graph reconcile always swallows here so the
 * safety net cannot fail on mentions.
 */
const REASON_TOKEN = /^[a-z][a-z0-9_]{0,39}$/;

export function needsReviewReasonTag(reason: string): string {
	return REASON_TOKEN.test(reason) ? `reason:${reason}` : "reason:execute_failed";
}

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
		...(input.reason ? [needsReviewReasonTag(input.reason)] : []),
		...(input.proposed_kind ? [`unhandled:${input.proposed_kind}`] : []),
		...(input.tags ?? []),
	];
	return createNote(
		sb,
		{
			body: input.body,
			source_type: "own_thought",
			needs_review: true,
			origin_capture_id: input.origin_capture_id ?? null,
			tags,
		},
		{ graphFail: "swallow" },
	);
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
	opts: NoteWriteOpts = {},
): Promise<void> {
	unwrap(await sb.from("notes").update(patch).eq("id", id));
	// Mentions/wikilinks only re-derive when body text moves (not pin/resolve).
	if ("body" in patch && patch.body !== undefined) {
		await syncNoteGraph(sb, id, patch.body, opts.graphFail ?? "throw");
	}
}

/**
 * Pin or unpin a note. The timestamp (not a bool) fixes pin order —
 * most-recently-pinned first.
 *
 * Desired state, not a flip (docs/adr/0037): the caller says where the note
 * should end up, and the write guards on the state it is moving away from, so
 * a stale second surface can't silently undo the first. Guarding on nullness
 * rather than the timestamp value is deliberate — round-tripping a timestamptz
 * through JS and comparing it exactly is fragile (`+00` vs `Z`, microseconds),
 * and nullness is the whole of the pin state. Re-pinning an already-pinned
 * note is therefore a no-op that preserves pin order.
 */
export async function setPin(
	sb: SupabaseClient,
	id: string,
	pinned: boolean,
): Promise<{ applied: boolean }> {
	const q = sb.from("notes");
	const rows = unwrap(
		await (pinned
			? q.update({ pinned_at: nowUtc() }).eq("id", id).is("pinned_at", null)
			: q.update({ pinned_at: null }).eq("id", id).not("pinned_at", "is", null)
		).select("id"),
	);
	return { applied: ((rows ?? []) as unknown[]).length > 0 };
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
