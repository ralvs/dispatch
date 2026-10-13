// The journal kind's writes (docs/adr/0077): each builder makes the intent
// and its server call from the same arguments. Client-safe — server-action
// references only.

import { nowUtc } from "@/lib/dates";
import {
	type CreateJournalEntryInput,
	createJournalEntryForm,
	type JournalEntryRow,
	pickedEntryDate,
} from "@/lib/schemas/journal";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import { createEntryAction, deleteEntryAction } from "./actions";

/** The entry the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticEntry(input: CreateJournalEntryInput): JournalEntryRow {
	return {
		id: crypto.randomUUID(),
		book_id: input.book_id ?? null,
		entry_date: input.entry_date,
		image_path: null,
		transcription_text: input.transcription_text,
		source: input.source ?? "typed",
		tags: input.tags ?? [],
		extracted_facts: {},
		attachments: [],
		resurface_weight: 1,
		created_at: nowUtc(),
	};
}

/**
 * The form with a blank date filled with `todayIso`, so the server writes the
 * day the list showed, not its own today (ADR-0077 item 2).
 */
function dated(form: FormData, todayIso: string): FormData {
	if (pickedEntryDate(form.get("entry_date")) !== null) return form;
	const copy = new FormData();
	for (const [key, value] of form) copy.append(key, value);
	copy.set("entry_date", todayIso);
	return copy;
}

export const journalWrites = {
	/**
	 * `todayIso` dates an entry whose form left the date blank, on both halves.
	 * A form the decoder refuses shows nothing; the server's field errors do
	 * (docs/adr/0087).
	 */
	create: (form: FormData, todayIso: string): Write<"journal"> => {
		const sent = dated(form, todayIso);
		const input = createJournalEntryForm.read(sent);
		return write(
			"journal",
			input ? { type: "create", row: optimisticEntry(input) } : unshown(),
			() => createEntryAction(sent),
		);
	},
	remove: (id: string): Write<"journal"> =>
		write("journal", { type: "delete", id }, () => deleteEntryAction(id), "Couldn't delete entry."),
};
