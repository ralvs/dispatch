import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
	type AnnotationContextSchema,
	QUOTE_ANNOTATION_SELECT,
	QUOTE_SELECT,
	type QuoteAddedViaSchema,
	type QuoteAnnotationRow,
	type QuoteRow,
	type QuoteSourceTypeSchema,
} from "@/lib/schemas/quote";
import { unwrap } from "@/lib/services/errors";

export type { QuoteAnnotationRow, QuoteRow };

// shape intentionally differs from CreateQuoteSchema: added_via here allows
// the full QuoteAddedViaSchema enum (incl. kindle_import, reserved for a
// future import job) while CreateQuoteSchema's zod validator restricts to
// DB_ADDED_VIA (the current CHECK constraint's value set, which excludes
// kindle_import). Keeping the wider hand-written type here.
export type CreateQuoteInput = {
	text: string;
	book_id?: string | null;
	page_number?: number | null;
	chapter?: string | null;
	source_type?: z.infer<typeof QuoteSourceTypeSchema> | null;
	source_reference?: string | null;
	source_url?: string | null;
	source_author?: string | null;
	tags?: string[];
	added_via?: z.infer<typeof QuoteAddedViaSchema>;
};

export async function listQuotes(
	sb: SupabaseClient,
	filters: { tag?: string } = {},
): Promise<QuoteRow[]> {
	let q = sb.from("quotes").select(QUOTE_SELECT).order("created_at", { ascending: false });
	if (filters.tag) q = q.contains("tags", [filters.tag]);
	const data = unwrap(await q);
	return (data ?? []) as unknown as QuoteRow[];
}

export async function getQuote(sb: SupabaseClient, id: string): Promise<QuoteRow | null> {
	const data = unwrap(await sb.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle());
	return (data as unknown as QuoteRow | null) ?? null;
}

/** Create a quote. Text is stored verbatim in whatever language it arrived in. */
export async function createQuote(sb: SupabaseClient, input: CreateQuoteInput): Promise<QuoteRow> {
	const data = unwrap(
		await sb
			.from("quotes")
			.insert({
				...input,
				added_via: input.added_via ?? "manual",
			})
			.select(QUOTE_SELECT)
			.single(),
	);
	return data as unknown as QuoteRow;
}

export async function updateQuote(
	sb: SupabaseClient,
	id: string,
	patch: Partial<CreateQuoteInput>,
): Promise<void> {
	unwrap(await sb.from("quotes").update(patch).eq("id", id));
}

export async function deleteQuote(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("quotes").delete().eq("id", id));
}

// ─── Quote annotations ──────────────────────────────────────────────────

export async function listAnnotations(
	sb: SupabaseClient,
	quoteId: string,
): Promise<QuoteAnnotationRow[]> {
	const data = unwrap(
		await sb
			.from("quote_annotations")
			.select(QUOTE_ANNOTATION_SELECT)
			.eq("quote_id", quoteId)
			.order("annotated_at", { ascending: false }),
	);
	return (data ?? []) as unknown as QuoteAnnotationRow[];
}

export async function createAnnotation(
	sb: SupabaseClient,
	input: {
		quote_id: string;
		body: string;
		context?: z.infer<typeof AnnotationContextSchema>;
		tags?: string[];
	},
): Promise<QuoteAnnotationRow> {
	const data = unwrap(
		await sb.from("quote_annotations").insert(input).select(QUOTE_ANNOTATION_SELECT).single(),
	);
	return data as unknown as QuoteAnnotationRow;
}

export async function updateAnnotation(
	sb: SupabaseClient,
	id: string,
	patch: Partial<{
		body: string;
		context: z.infer<typeof AnnotationContextSchema>;
		tags: string[];
	}>,
): Promise<void> {
	unwrap(await sb.from("quote_annotations").update(patch).eq("id", id));
}

export async function deleteAnnotation(sb: SupabaseClient, id: string): Promise<void> {
	unwrap(await sb.from("quote_annotations").delete().eq("id", id));
}
