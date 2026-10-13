// The quote kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Client-safe — server-action
// references only.

import { nowUtc } from "@/lib/dates";
import { type CreateQuoteInput, createQuoteForm, type QuoteRow } from "@/lib/schemas/quote";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import { createQuoteAction, deleteQuoteAction } from "./actions";

/** The row the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticQuote(input: CreateQuoteInput): QuoteRow {
	return {
		id: crypto.randomUUID(),
		text: input.text,
		page_number: input.page_number ?? null,
		chapter: input.chapter ?? null,
		source_type: input.source_type ?? null,
		source_reference: input.source_reference ?? null,
		source_url: input.source_url ?? null,
		source_author: input.source_author ?? null,
		tags: input.tags ?? [],
		added_via: input.added_via ?? "manual",
		last_surfaced_at: null,
		created_at: nowUtc(),
	};
}

export const quoteWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	create: (form: FormData): Write<"quote"> => {
		const input = createQuoteForm.read(form);
		return write("quote", input ? { type: "create", row: optimisticQuote(input) } : unshown(), () =>
			createQuoteAction(form),
		);
	},
	remove: (id: string): Write<"quote"> =>
		write("quote", { type: "delete", id }, () => deleteQuoteAction(id), "Couldn't delete quote."),
};
