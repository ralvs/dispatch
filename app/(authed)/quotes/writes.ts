// The quote kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Client-safe — server-action
// references only.

import { nowUtc } from "@/lib/dates";
import { type QuoteRow, QuoteSourceTypeSchema } from "@/lib/schemas/quote";
import { type Write, write } from "@/lib/store/write";
import { createQuoteAction, deleteQuoteAction } from "./actions";

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

export const quoteWrites = {
	create: (form: FormData): Write<"quote"> =>
		write("quote", { type: "create", row: optimisticQuote(form) }, () => createQuoteAction(form)),
	remove: (id: string): Write<"quote"> =>
		write("quote", { type: "delete", id }, () => deleteQuoteAction(id), "Couldn't delete quote."),
};
