"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { createNote, deleteNote, resolveNeedsReview, updateNote } from "@/lib/services/notes";

function revalidateNoteViews(id?: string) {
	revalidatePath("/notes");
	if (id) revalidatePath(`/notes/${id}`);
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
	await updateNote(sb, z.uuid().parse(id), {
		title: parsed.title !== null && parsed.title.trim() !== "" ? parsed.title : null,
		body: parsed.body,
	});
	revalidateNoteViews(id);
}

export async function resolveNeedsReviewAction(id: string) {
	const { sb } = await requireOwnerPage();
	await resolveNeedsReview(sb, z.uuid().parse(id));
	revalidateNoteViews(id);
}

export async function deleteNoteAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteNote(sb, z.uuid().parse(id));
	revalidateNoteViews();
	redirect("/notes");
}
