"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateJournalEntrySchema } from "@/lib/schemas/journal";
import { createEntry, deleteEntry } from "@/lib/services/journal";
import { todayForRequest } from "@/lib/services/settings";

function revalidateJournalViews() {
	afterMutation("journal.write");
}

function tagsFromForm(raw: FormDataEntryValue | null): string[] | undefined {
	if (typeof raw !== "string") return undefined;
	const tags = raw
		.split(",")
		.map((t) => t.trim())
		.filter(Boolean);
	return tags.length > 0 ? tags : [];
}

export async function createEntryAction(formData: FormData): Promise<ActionResult> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const entryDate = formData.get("entry_date");
		const parsed = decodeForm(CreateJournalEntrySchema, formData, {
			overrides: {
				tags: tagsFromForm(formData.get("tags")),
				entry_date:
					typeof entryDate === "string" && entryDate ? entryDate : await todayForRequest(sb),
			},
		});
		await createEntry(sb, parsed);
		revalidateJournalViews();
	});
}

export async function deleteEntryAction(id: string) {
	const { sb } = await requireOwnerPage();
	await deleteEntry(sb, z.uuid().parse(id));
	revalidateJournalViews();
}
