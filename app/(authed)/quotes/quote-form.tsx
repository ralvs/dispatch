"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { nowUtc } from "@/lib/dates";
import { type QuoteRow, QuoteSourceTypeSchema } from "@/lib/schemas/quote";
import { useStoreWrite } from "@/lib/store";
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

/** The row the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticQuote(formData: FormData): QuoteRow {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const source = QuoteSourceTypeSchema.safeParse(formData.get("source_type"));
	return {
		id: crypto.randomUUID(),
		text: text("text") ?? "",
		page_number: null,
		chapter: null,
		source_type: source.success ? source.data : null,
		source_reference: null,
		source_url: null,
		source_author: text("source_author"),
		tags: (text("tags") ?? "")
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean),
		added_via: "manual",
		last_surfaced_at: null,
		created_at: nowUtc(),
	};
}

/** Create a quote — dialog behind the header's `+` (Gate B / B1). */
export function QuoteCreateButton() {
	const write = useStoreWrite("quote");

	return (
		<CreateDialogButton
			label="New quote"
			title="New quote"
			submitLabel="Add quote"
			errorMessage="Couldn't save quote. Try again."
			action={(formData) =>
				write({ type: "create", row: optimisticQuote(formData) }, () => createQuoteAction(formData))
			}
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
