"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
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
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Entry</span>
				<textarea
					name="transcription_text"
					required
					rows={5}
					aria-label="Journal entry"
					placeholder="What happened today?"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Date</span>
					<input
						type="date"
						name="entry_date"
						defaultValue={todayIso}
						aria-label="Entry date"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Tags</span>
					<input
						name="tags"
						placeholder="comma, separated"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
