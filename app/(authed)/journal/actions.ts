"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/invalidate";
import { createJournalEntryForm, pickedEntryDate } from "@/lib/schemas/journal";
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

export async function createEntryAction(formData: FormData): Promise<ActionResult<JournalWrite>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const parsed = createJournalEntryForm.parse(formData, {
			entry_date: pickedEntryDate(formData.get("entry_date")) ?? (await todayForRequest(sb)),
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
