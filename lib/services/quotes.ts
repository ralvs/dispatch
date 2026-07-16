import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type {
	AnnotationContextSchema,
	QuoteAddedViaSchema,
	QuoteSourceTypeSchema,
} from "@/lib/schemas/quote";
import { unwrap } from "@/lib/services/errors";

// Explicit columns, mirroring TASK_SELECT/NOTE_SELECT — no FK-join flattening
// needed here (quotes has no relations the UI reads through a join).
const QUOTE_SELECT =
	"id, book_id, text, page_number, chapter, source_type, source_reference, source_url, source_author, tags, added_via, last_surfaced_at, created_at";

export type QuoteRow = {
	id: string;
	book_id: string | null;
	text: string;
	page_number: number | null;
	chapter: string | null;
	source_type: z.infer<typeof QuoteSourceTypeSchema> | null;
	source_reference: string | null;
	source_url: string | null;
	source_author: string | null;
	tags: string[];
	added_via: z.infer<typeof QuoteAddedViaSchema>;
	last_surfaced_at: string | null;
	created_at: string;
};

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
	return (data ?? []) as QuoteRow[];
}

export async function getQuote(sb: SupabaseClient, id: string): Promise<QuoteRow | null> {
	const data = unwrap(await sb.from("quotes").select(QUOTE_SELECT).eq("id", id).maybeSingle());
	return (data as QuoteRow | null) ?? null;
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
	return data as QuoteRow;
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

const QUOTE_ANNOTATION_SELECT =
	"id, quote_id, body, annotated_at, context, tags, created_at, updated_at";

export type QuoteAnnotationRow = {
	id: string;
	quote_id: string;
	body: string;
	annotated_at: string;
	context: z.infer<typeof AnnotationContextSchema>;
	tags: string[];
	created_at: string;
	updated_at: string;
};

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
	return (data ?? []) as QuoteAnnotationRow[];
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
	return data as QuoteAnnotationRow;
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
