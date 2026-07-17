"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createNoteAction } from "./actions";

const SOURCE_TYPES = [
	{ value: "own_thought", label: "Own thought" },
	{ value: "reading_response", label: "Reading response" },
	{ value: "meeting_note", label: "Meeting note" },
	{ value: "brainstorm", label: "Brainstorm" },
	{ value: "observation", label: "Observation" },
	{ value: "other", label: "Other" },
];

export function NoteForm() {
	const form = useCollapsibleForm(createNoteAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New note"
			submitLabel="Add note"
			pendingLabel="Adding…"
		>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Title</span>
				<input
					name="title"
					placeholder="Optional"
					className="mt-1 w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Body</span>
				<textarea
					name="body"
					required
					rows={3}
					aria-label="Note body"
					placeholder="What's on your mind?"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Source</span>
					<select
						name="source_type"
						defaultValue="own_thought"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						{SOURCE_TYPES.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Tags</span>
					<input
						name="tags"
						placeholder="comma, separated"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
