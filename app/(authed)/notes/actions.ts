"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { CreateNoteSchema, UpdateNoteSchema } from "@/lib/schemas/note";
import { createNote, deleteNote, resolveNeedsReview, updateNote } from "@/lib/services/notes";

function revalidateNoteViews() {
	revalidatePath("/notes");
}

function tagsFromForm(raw: FormDataEntryValue | null): string[] | undefined {
	if (typeof raw !== "string") return undefined;
	const tags = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	return tags.length > 0 ? tags : [];
}

export async function createNoteAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = CreateNoteSchema.parse({
		title: formData.get("title") || null,
		body: formData.get("body"),
		source_type: formData.get("source_type") || undefined,
		tags: tagsFromForm(formData.get("tags")),
	});
	await createNote(sb, parsed);
	revalidateNoteViews();
}

export async function updateNoteAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = UpdateNoteSchema.parse({
		title: formData.get("title") || null,
		body: formData.get("body"),
		source_type: formData.get("source_type") || undefined,
		tags: tagsFromForm(formData.get("tags")),
	});
	await updateNote(sb, z.uuid().parse(id), parsed);
	revalidateNoteViews();
}

export async function resolveNeedsReviewAction(id: string) {
	const { sb } = await requireOwnerPage();
	await resolveNeedsReview(sb, z.uuid().parse(id));
	revalidateNoteViews();
}

export async function deleteNoteAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteNote(sb, z.uuid().parse(id));
	revalidateNoteViews();
}
