"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createQuoteAction } from "./actions";

const SOURCE_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "book", label: "Book" },
	{ value: "article", label: "Article" },
	{ value: "podcast", label: "Podcast" },
	{ value: "video", label: "Video" },
	{ value: "conversation", label: "Conversation" },
	{ value: "other", label: "Other" },
];

export function QuoteForm() {
	const form = useCollapsibleForm(createQuoteAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New quote"
			submitLabel="Add quote"
			pendingLabel="Adding…"
		>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Text</span>
				<textarea
					name="text"
					required
					rows={3}
					aria-label="Quote text"
					placeholder="Copy it verbatim"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Source</span>
					<select
						name="source_type"
						defaultValue=""
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						{SOURCE_TYPES.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Author</span>
					<input
						name="source_author"
						placeholder="Optional"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="col-span-2 block">
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
