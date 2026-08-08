"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { Field, Input, Textarea } from "@/components/ui";
import { createEntryAction } from "./actions";

export function JournalForm({ todayIso }: { todayIso: string }) {
	const form = useCollapsibleForm(createEntryAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New entry"
			submitLabel="Save entry"
			pendingLabel="Saving…"
		>
			<Field label="Entry">
				<Textarea
					name="transcription_text"
					required
					rows={5}
					aria-label="Journal entry"
					placeholder="What happened today?"
					className="type-title text-base"
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Date">
					<Input type="date" name="entry_date" defaultValue={todayIso} aria-label="Entry date" />
				</Field>
				<Field label="Tags">
					<Input name="tags" placeholder="comma, separated" />
				</Field>
			</div>
		</CollapsibleForm>
	);
}
