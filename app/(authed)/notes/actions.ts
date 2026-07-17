"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
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
	const parsed = decodeForm(CreateNoteSchema, formData, {
		overrides: { tags: tagsFromForm(formData.get("tags")), body: formData.get("body") },
	});
	await createNote(sb, parsed);
	revalidateNoteViews();
}

export async function updateNoteAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	// body is passed via override, not the blank-rule: UpdateNoteSchema (a
	// .partial()) makes body optional/non-nullable, so a blank value would
	// otherwise be silently omitted (no-op update) instead of throwing —
	// override preserves the original "blank body always rejects" behavior.
	const parsed = decodeForm(UpdateNoteSchema, formData, {
		overrides: { tags: tagsFromForm(formData.get("tags")), body: formData.get("body") },
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
