import "server-only";
import type { z } from "zod";
import { nowUtc } from "@/lib/dates";
import { escapeLike } from "@/lib/like";
import {
	type CreateNoteSchema,
	NOTE_LIST_SELECT,
	type NoteListRow,
	type NoteRow,
	type UpdateNoteSchema,
} from "@/lib/schemas/note";
import { AppendRefusedError, PartialWriteError, unwrap, unwrapCount } from "@/lib/services/errors";
import { type GraphFail, syncNoteMentionsFromText } from "@/lib/services/mentions";
import { removeAllForNote } from "@/lib/services/note-attachments";
import { syncWikilinks } from "@/lib/services/note-links";
import type { SupabaseClient } from "@/lib/supabase/types";
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
	domain_id?: string | null;
	related_project_id?: string | null;
	related_person_id?: string | null;
	related_quote_id?: string | null;
	needs_review?: boolean;
	origin_capture_id?: string | null;
};

/** Create a note. Body is stored verbatim in whatever language it arrived in. */
/** Returns the list row, so a write can hand it to the entity store as it is. */
export async function createNote(
	sb: SupabaseClient,
	input: CreateNoteInput,
	opts: NoteWriteOpts = {},
): Promise<NoteListRow> {
	const data = unwrap(
		await sb
			.from("notes")
			.insert({
				...input,
				source_type: input.source_type ?? "own_thought",
			})
			.select(NOTE_LIST_SELECT)
			.single(),
	);
	const note = data;
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
): Promise<NoteListRow> {
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
	filters: {
		needsReview?: boolean;
		/** A titled note matches on its title; an untitled one on its body. */
		query?: string;
		/** null means unfiled. */
		domainId?: string | null;
		pinned?: boolean;
		limit?: number;
	} = {},
): Promise<NoteListRow[]> {
	let q = sb
		.from("notes")
		.select(NOTE_LIST_SELECT)
		.order("pinned_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false });
	if (filters.needsReview !== undefined) q = q.eq("needs_review", filters.needsReview);
	if (filters.query) {
		// Double-quoted so commas and parens in the query cannot break the or() list.
		const pattern = `"%${escapeLike(filters.query).replace(/["\\]/g, (m) => `\\${m}`)}%"`;
		q = q.or(`title.ilike.${pattern},and(title.is.null,body.ilike.${pattern})`);
	}
	if (filters.domainId === null) q = q.is("domain_id", null);
	else if (filters.domainId !== undefined) q = q.eq("domain_id", filters.domainId);
	if (filters.pinned === true) q = q.not("pinned_at", "is", null);
	else if (filters.pinned === false) q = q.is("pinned_at", null);
	if (filters.limit !== undefined) q = q.limit(filters.limit);
	const data = unwrap(await q);
	return data ?? [];
}

export async function getNote(sb: SupabaseClient, id: string): Promise<NoteListRow | null> {
	const data = unwrap(await sb.from("notes").select(NOTE_LIST_SELECT).eq("id", id).maybeSingle());
	return data ?? null;
}

export type NotePatch = z.infer<typeof UpdateNoteSchema> & {
	/**
	 * A line added to the end of the body, in one UPDATE (`note_body_append`),
	 * so two appends at once both survive. Not with `body`.
	 */
	body_append?: string;
};

/**
 * Edit a note. A text write owns the note graph: when the body moves, by a
 * patch or an append, wikilinks and mentions re-derive once from the saved
 * body. Callers must not post-sync.
 *
 * An append runs first, so a refusal (AppendRefusedError) writes nothing. If
 * it lands and a later step fails, the graph is re-derived if it can be and
 * the error is a PartialWriteError: the row changed, and the caller still
 * owes its ledger row.
 */
export async function updateNote(
	sb: SupabaseClient,
	id: string,
	patch: NotePatch,
	opts: NoteWriteOpts = {},
): Promise<void> {
	const { body_append, ...fields } = patch;
	const fail = opts.graphFail ?? "throw";
	if (body_append === undefined) {
		unwrap(await sb.from("notes").update(fields).eq("id", id));
		// Mentions/wikilinks only re-derive when body text moves (not pin/resolve).
		if (fields.body !== undefined) await syncNoteGraph(sb, id, fields.body, fail);
		return;
	}
	if (fields.body !== undefined)
		throw new Error("A note edit sends body or body_append, not both.");
	const [appended] = unwrap(
		await sb.rpc("note_body_append", { p_note_id: id, p_line: body_append }),
	);
	if (!appended) throw new AppendRefusedError("No note with that id.");
	try {
		if (Object.keys(fields).length > 0) {
			unwrap(await sb.from("notes").update(fields).eq("id", id));
		}
		await syncNoteGraph(sb, id, await savedBody(sb, id), fail);
	} catch (err) {
		try {
			await syncNoteGraph(sb, id, await savedBody(sb, id), "throw");
		} catch (syncErr) {
			console.error("[notes] graph re-sync after a failed edit", syncErr);
		}
		throw new PartialWriteError(err);
	}
}

/** The body as saved now: another append may have landed since this one. */
async function savedBody(sb: SupabaseClient, id: string): Promise<string> {
	return unwrap(await sb.from("notes").select("body").eq("id", id).single()).body;
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
	return { applied: (rows ?? []).length > 0 };
}

/** Resolve the never-lose safety net (iron rule #4) without touching the body. */
export async function resolveNeedsReview(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").update({ needs_review: false }).eq("id", id));
}

export async function deleteNote(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("notes").delete().eq("id", id));
	// Best-effort, and deliberately after the row is gone: the note is what the
	// user asked to delete, so an R2 hiccup must not resurrect it. Worst case
	// the objects are orphaned bytes nothing links to (docs/adr/0052).
	try {
		await removeAllForNote(id);
	} catch {
		// Swept on the next delete of the same prefix, or never — either beats
		// failing a delete the user already saw succeed.
	}
}

/**
 * Minimal id/title/body projection for wikilink resolution — all notes, no
 * filtering.
 *
 * `body` is cut to its first line before it leaves this function. The only
 * consumer is displayTitle (lib/note-display.ts), which reads
 * `body.split("\n")[0]` as the label for an untitled note, so the labels are
 * identical — but the full bodies were being serialized into the RSC payload
 * of every /notes/[id] open and shipped over the network to the phone. Cutting
 * here rather than in the select keeps this a single unindexed read; moving it
 * into SQL would need a view or an RPC.
 */
export async function listNoteTitles(
	sb: SupabaseClient,
): Promise<Array<{ id: string; title: string | null; body: string }>> {
	const data = unwrap(
		await sb.from("notes").select("id, title, body").order("created_at", { ascending: false }),
	);
	return (data ?? []).map((note) => ({
		id: note.id,
		title: note.title,
		body: note.body?.split("\n", 1)[0] ?? "",
	}));
}

/**
 * Today's review count, counted in the database. It is `noteCounts`
 * (lib/counts.ts) as a filter, as `notQuietFilter` is `isQuiet`: Today does
 * not read the notes, so it cannot sum them. notes.int.test.ts holds the two
 * to the same answer.
 */
export async function countNeedsReview(sb: SupabaseClient): Promise<number> {
	return unwrapCount(
		await sb.from("notes").select("*", { count: "exact", head: true }).eq("needs_review", true),
	);
}
