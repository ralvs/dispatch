"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { CreateJournalEntrySchema } from "@/lib/schemas/journal";
import { createEntry, deleteEntry } from "@/lib/services/journal";
import { getAppTimezone } from "@/lib/services/settings";

function revalidateJournalViews() {
	revalidatePath("/journal");
}

function tagsFromForm(raw: FormDataEntryValue | null): string[] | undefined {
	if (typeof raw !== "string") return undefined;
	const tags = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	return tags.length > 0 ? tags : [];
}

export async function createEntryAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const entryDate = formData.get("entry_date");
	const parsed = CreateJournalEntrySchema.parse({
		transcription_text: formData.get("transcription_text"),
		entry_date: typeof entryDate === "string" && entryDate ? entryDate : todayInTz(tz),
		tags: tagsFromForm(formData.get("tags")),
	});
	await createEntry(sb, parsed);
	revalidateJournalViews();
}

export async function deleteEntryAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteEntry(sb, z.uuid().parse(id));
	revalidateJournalViews();
}
