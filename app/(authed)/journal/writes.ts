// The journal kind's writes (docs/adr/0077): each builder makes the intent
// and its server call from the same arguments. Client-safe — server-action
// references only.

import { nowUtc } from "@/lib/dates";
import type { JournalEntryRow } from "@/lib/schemas/journal";
import { type Write, write } from "@/lib/store/write";
import { createEntryAction, deleteEntryAction } from "./actions";

/** The entry the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticEntry(formData: FormData, todayIso: string): JournalEntryRow {
	const field = (key: string) => String(formData.get(key) ?? "").trim();
	return {
		id: crypto.randomUUID(),
		book_id: null,
		entry_date: /^\d{4}-\d{2}-\d{2}$/.test(field("entry_date")) ? field("entry_date") : todayIso,
		image_path: null,
		transcription_text: field("transcription_text") || null,
		source: "typed",
		tags: field("tags")
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean),
		extracted_facts: {},
		attachments: [],
		resurface_weight: 1,
		created_at: nowUtc(),
	};
}

export const journalWrites = {
	/** `todayIso` dates an entry whose form left the date blank, as the server does. */
	create: (form: FormData, todayIso: string): Write<"journal"> =>
		write("journal", { type: "create", row: optimisticEntry(form, todayIso) }, () =>
			createEntryAction(form),
		),
	remove: (id: string): Write<"journal"> =>
		write("journal", { type: "delete", id }, () => deleteEntryAction(id), "Couldn't delete entry."),
};
