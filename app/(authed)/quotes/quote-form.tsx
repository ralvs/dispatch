"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { Field, Input, Select, Textarea } from "@/components/ui";
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
			<Field label="Text">
				<Textarea
					name="text"
					required
					rows={3}
					aria-label="Quote text"
					placeholder="Copy it verbatim"
					className="type-title text-base"
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Source">
					<Select name="source_type" defaultValue="">
						{SOURCE_TYPES.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Author">
					<Input name="source_author" placeholder="Optional" />
				</Field>
				<Field label="Tags" className="col-span-2">
					<Input name="tags" placeholder="comma, separated" />
				</Field>
			</div>
		</CollapsibleForm>
	);
}
