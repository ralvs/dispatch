"use client";

import { Field, Input, Textarea } from "@/components/ui";
import { useWrites } from "@/lib/store";
import { CollapsibleForm } from "./collapsible-form";
import { journalWrites } from "./writes";

export function JournalForm({ todayIso }: { todayIso: string }) {
	const { submit } = useWrites();

	return (
		<CollapsibleForm
			action={(formData) => submit(journalWrites.create(formData, todayIso))}
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
