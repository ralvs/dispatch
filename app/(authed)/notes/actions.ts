"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { afterMutation } from "@/lib/invalidate";
import type { NoteListRow } from "@/lib/schemas/note";
import { searchEventsByTitle } from "@/lib/services/calendar";
import { removeAttachment } from "@/lib/services/note-attachments";
import { createManualLink, deleteLink } from "@/lib/services/note-links";
import {
	createNote,
	deleteNote,
	getNote,
	resolveNeedsReview,
	setPin,
	updateNote,
} from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";
import { searchTasksByTitle } from "@/lib/services/tasks";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// The actions that change a note return it as it now stands (#27), so the
// client's entity store confirms its optimistic intent from it instead of
// waiting on a page render. Failures still throw; the store runner rolls back
// on a throw. The link actions change the link rail, not a note row, and stay
// as they are.

type NoteWrite = StoreWrite<NoteListRow>;

function revalidateNoteViews() {
	afterMutation("notes.write");
}

/** The note read back after the write. A note that is gone comes back as a deleted id. */
async function writtenNote(sb: SupabaseClient, id: string): Promise<ActionResult<NoteWrite>> {
	const row = await getNote(sb, id);
	return { ok: true, data: row ? stampWrite([row]) : stampWrite([], [id]) };
}

/**
 * Apple Notes-style creation: the row exists before any content does, so the
 * editor page always autosaves against a real id. The body starts empty —
 * blank notes are a valid editor state (docs/adr/0012), unlike the old
 * create-form flow.
 */
export async function createBlankNoteAction() {
	const { sb } = await requireOwnerPage();
	const note = await createNote(sb, { body: "", source_type: "own_thought" });
	revalidateNoteViews();
	redirect(`/notes/${note.id}`);
}

const SaveNoteSchema = z.object({
	title: z.string().nullable(),
	body: z.string(),
});

/** Autosave from the editor page. Empty body is allowed — a cleared note stays a note. */
export async function saveNoteAction(
	id: string,
	input: { title: string | null; body: string },
): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const parsed = SaveNoteSchema.parse(input);
	const noteId = z.uuid().parse(id);
	await updateNote(sb, noteId, {
		title: parsed.title !== null && parsed.title.trim() !== "" ? parsed.title : null,
		body: parsed.body,
	});
	revalidateNoteViews();
	return writtenNote(sb, noteId);
}

/**
 * File a note under a domain, or unfile it. Optional by design — there is no
 * Inbox fallback and a loose thought stays loose (shape plan D1) — so "" from
 * the select means null, not "leave it alone".
 */
export async function setNoteDomainAction(
	id: string,
	domainId: string,
): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const noteId = z.uuid().parse(id);
	const domain = domainId === "" ? null : z.uuid().parse(domainId);
	await updateNote(sb, noteId, { domain_id: domain });
	revalidateNoteViews();
	return writtenNote(sb, noteId);
}

export async function resolveNeedsReviewAction(id: string): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const noteId = z.uuid().parse(id);
	await resolveNeedsReview(sb, noteId);
	revalidateNoteViews();
	return writtenNote(sb, noteId);
}

/** A pin the precondition refused (docs/adr/0037) still answers with the row as it stands. */
export async function setPinAction(input: {
	id: string;
	pinned: boolean;
}): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const noteId = z.uuid().parse(input.id);
	await setPin(sb, noteId, z.boolean().parse(input.pinned));
	revalidateNoteViews();
	return writtenNote(sb, noteId);
}

/**
 * Delete a note. The editor navigates to /notes once the store has confirmed
 * it, so the list it lands on no longer holds the row (#27) — a redirect()
 * here would roll the intent back instead.
 */
export async function deleteNoteAction(id: string): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const noteId = z.uuid().parse(id);
	await deleteNote(sb, noteId);
	revalidateNoteViews();
	return { ok: true, data: stampWrite([], [noteId]) };
}

const LinkTargetTypeSchema = z.enum(["task", "event"]);

export async function attachLinkAction(
	noteId: string,
	targetType: "task" | "event",
	targetId: string,
) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(noteId);
	const type = LinkTargetTypeSchema.parse(targetType);
	const target = z.uuid().parse(targetId);
	await createManualLink(sb, { note_id: id, target_type: type, target_id: target });
	// The link rail is server-rendered from note_links, which the entity
	// store does not hold: re-render it (lib/invalidate.ts).
	afterMutation("notes.links");
}

/**
 * Remove one file from a note (docs/adr/0052). Upload is a route handler
 * because it carries binary; removal is an action, matching the link rail it
 * sits beside. The storage path identifies the file — the client already has
 * it from the attachment row, and it is validated against the note by the
 * RPC's `where id = p_note_id`.
 */
export async function removeAttachmentAction(
	noteId: string,
	storagePath: string,
): Promise<ActionResult<NoteWrite>> {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(noteId);
	const path = z.string().min(1).parse(storagePath);
	await removeAttachment(sb, id, path);
	revalidateNoteViews();
	return writtenNote(sb, id);
}

export async function detachLinkAction(noteId: string, linkId: string) {
	const { sb } = await requireOwnerPage();
	z.uuid().parse(noteId);
	await deleteLink(sb, z.uuid().parse(linkId));
	// The link rail is server-rendered from note_links, which the entity
	// store does not hold: re-render it (lib/invalidate.ts).
	afterMutation("notes.links");
}

/** Read-only: powers the link-picker's search dropdown. No afterMutation. */
export async function searchLinkTargetsAction(
	targetType: "task" | "event",
	q: string,
): Promise<Array<{ id: string; label: string }>> {
	const { sb } = await requireOwnerPage();
	const type = LinkTargetTypeSchema.parse(targetType);
	const query = q.trim();
	if (query === "") return [];

	if (type === "task") {
		const tasks = await searchTasksByTitle(sb, query);
		return tasks.map((t) => ({
			id: t.id,
			label: t.status === "done" ? `${t.title} · done` : t.title,
		}));
	}

	const tz = await getAppTimezone(sb);
	const events = await searchEventsByTitle(sb, query);
	return events.map((e) => ({
		id: e.id,
		label: `${e.title} · ${formatInstant(e.start_at, tz)}`,
	}));
}
