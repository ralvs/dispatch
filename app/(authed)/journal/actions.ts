"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateJournalEntrySchema } from "@/lib/schemas/journal";
import { createEntry, deleteEntry, type JournalEntryRow } from "@/lib/services/journal";
import { todayForRequest } from "@/lib/services/settings";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// The journal actions return what they wrote (#30), so the client's entity
// store confirms its optimistic intent from it instead of waiting on a page
// render.

type JournalWrite = StoreWrite<JournalEntryRow>;

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

export async function createEntryAction(formData: FormData): Promise<ActionResult<JournalWrite>> {
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
		const entry = await createEntry(sb, parsed);
		revalidateJournalViews();
		return stampWrite([entry]);
	});
}

export async function deleteEntryAction(id: string): Promise<ActionResult<JournalWrite>> {
	const { sb } = await requireOwnerPage();
	const entryId = z.uuid().parse(id);
	await deleteEntry(sb, entryId);
	revalidateJournalViews();
	return { ok: true, data: stampWrite([], [entryId]) };
}
