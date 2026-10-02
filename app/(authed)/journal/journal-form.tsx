"use client";

import { Field, Input, Textarea } from "@/components/ui";
import { nowUtc } from "@/lib/dates";
import type { JournalEntryRow } from "@/lib/schemas/journal";
import { useStoreWrite } from "@/lib/store";
import { createEntryAction } from "./actions";
import { CollapsibleForm } from "./collapsible-form";

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

export function JournalForm({ todayIso }: { todayIso: string }) {
	const write = useStoreWrite("journal");

	return (
		<CollapsibleForm
			action={(formData) =>
				write({ type: "create", row: optimisticEntry(formData, todayIso) }, () =>
					createEntryAction(formData),
				)
			}
			errorMessage="Couldn't save entry. Try again."
			triggerLabel="+ New entry"
			submitLabel="Save entry"
			pendingLabel="Saving…"
		>
			<Field label="Entry" name="transcription_text">
				<Textarea
					name="transcription_text"
					required
					rows={5}
					aria-label="Journal entry"
					placeholder="What happened today?"
					className="text-base font-normal tracking-[-0.01em]"
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Date" name="entry_date">
					<Input type="date" name="entry_date" defaultValue={todayIso} aria-label="Entry date" />
				</Field>
				<Field label="Tags" name="tags">
					<Input name="tags" placeholder="comma, separated" />
				</Field>
			</div>
		</CollapsibleForm>
	);
}
