"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { formatInstant } from "@/lib/dates";
import { extractMentionMatches } from "@/lib/mentions";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { searchEventsByTitle } from "@/lib/services/calendar";
import { syncMentions } from "@/lib/services/mentions";
import { createManualLink, deleteLink, syncWikilinks } from "@/lib/services/note-links";
import {
	createNote,
	deleteNote,
	resolveNeedsReview,
	setPin,
	updateNote,
} from "@/lib/services/notes";
import { getAppTimezone } from "@/lib/services/settings";
import { searchTasksByTitle } from "@/lib/services/tasks";
import { extractWikilinkIds } from "@/lib/wikilinks";

function revalidateNoteViews(id?: string) {
	afterMutation("notes.write", id ? { id } : undefined);
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
export async function saveNoteAction(id: string, input: { title: string | null; body: string }) {
	const { sb } = await requireOwnerPage();
	const parsed = SaveNoteSchema.parse(input);
	const noteId = z.uuid().parse(id);
	await updateNote(sb, noteId, {
		title: parsed.title !== null && parsed.title.trim() !== "" ? parsed.title : null,
		body: parsed.body,
	});
	await syncWikilinks(sb, noteId, extractWikilinkIds(parsed.body));
	await syncMentions(sb, { type: "note", id: noteId }, extractMentionMatches(parsed.body));
	revalidateNoteViews(id);
}

export async function resolveNeedsReviewAction(id: string) {
	const { sb } = await requireOwnerPage();
	await resolveNeedsReview(sb, z.uuid().parse(id));
	revalidateNoteViews(id);
}

export async function setPinAction(input: { id: string; pinned: boolean }) {
	const { sb } = await requireOwnerPage();
	await setPin(sb, z.uuid().parse(input.id), input.pinned);
	revalidateNoteViews(input.id);
}

export async function deleteNoteAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteNote(sb, z.uuid().parse(id));
	revalidateNoteViews();
	redirect("/notes");
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
	revalidateNoteViews(id);
}

export async function detachLinkAction(noteId: string, linkId: string) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(noteId);
	await deleteLink(sb, z.uuid().parse(linkId));
	revalidateNoteViews(id);
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
