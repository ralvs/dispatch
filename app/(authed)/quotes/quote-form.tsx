"use client";

import { CreateDialogButton } from "@/components/create-dialog";
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

/** Create a quote — dialog behind the header's `+` (Gate B / B1). */
export function QuoteCreateButton() {
	return (
		<CreateDialogButton
			label="New quote"
			title="New quote"
			submitLabel="Add quote"
			errorMessage="Couldn't save quote. Try again."
			action={createQuoteAction}
		>
			<Field label="Text" name="text">
				<Textarea
					name="text"
					required
					rows={3}
					aria-label="Quote text"
					placeholder="Copy it verbatim"
					className="text-base"
					data-autofocus
				/>
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Source" name="source_type">
					<Select name="source_type" defaultValue="">
						{SOURCE_TYPES.map((s) => (
							<option key={s.value} value={s.value}>
								{s.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Author" name="source_author">
					<Input name="source_author" placeholder="Optional" />
				</Field>
				<Field label="Tags" className="col-span-2" name="tags">
					<Input name="tags" placeholder="comma, separated" />
				</Field>
			</div>
		</CreateDialogButton>
	);
}
