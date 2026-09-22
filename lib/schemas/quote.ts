import { z } from "zod";

// Spec Addendum 02 §3 — quotes lose `my_notes` (replaced by
// quote_annotations) and gain source_reference for non-DB sources.

export const QuoteSourceTypeSchema = z.enum([
	"book",
	"article",
	"podcast",
	"video",
	"conversation",
	"other",
]);

export const QuoteAddedViaSchema = z.enum([
	"voice",
	"kindle_import",
	"readwise_import",
	"manual",
	"journal_extraction",
]);

export const QuoteSchema = z.object({
	id: z.string().uuid(),
	text: z.string().min(1),
	page_number: z.union([z.number().int(), z.string()]).nullable().optional(),
	chapter: z.string().nullable().optional(),
	source_type: QuoteSourceTypeSchema.nullable().optional(),
	source_reference: z.string().nullable().optional(),
	source_url: z.string().url().nullable().optional(),
	source_author: z.string().nullable().optional(),
	tags: z.array(z.string()).default([]),
	added_via: QuoteAddedViaSchema.default("manual"),
	last_surfaced_at: z.string().datetime({ offset: true }).nullable().optional(),
	created_at: z.string().datetime({ offset: true }),
});

// Source types and added_via values that the DB CHECK constraint accepts.
const DB_SOURCE_TYPES = ["book", "article", "podcast", "video", "conversation", "other"] as const;
const DB_ADDED_VIA = ["voice", "readwise_import", "manual", "journal_extraction"] as const;

export const CreateQuoteSchema = z.object({
	text: z.string({ error: "Write the quote." }).min(1, "Write the quote."),
	page_number: z.number().int().nullable().optional(),
	chapter: z.string().nullable().optional(),
	source_type: z.enum(DB_SOURCE_TYPES).nullable().optional(),
	source_reference: z.string().nullable().optional(),
	source_url: z.string().url().nullable().optional(),
	source_author: z.string().nullable().optional(),
	tags: z.array(z.string()).optional(),
	added_via: z.enum(DB_ADDED_VIA).optional(),
});

export const UpdateQuoteSchema = CreateQuoteSchema.partial().extend({
	resurface_weight: z.number().min(0).optional(),
});

// ─── Quote annotations ──────────────────────────────────────────────────

export const AnnotationContextSchema = z.enum([
	"on_capture",
	"on_revisit",
	"on_surface",
	"unspecified",
]);

export const QuoteAnnotationSchema = z.object({
	id: z.string().uuid(),
	quote_id: z.string().uuid(),
	body: z.string().min(1),
	annotated_at: z.string().datetime({ offset: true }),
	context: AnnotationContextSchema.default("unspecified"),
	tags: z.array(z.string()).default([]),
	created_at: z.string().datetime({ offset: true }),
	updated_at: z.string().datetime({ offset: true }),
});

export const CreateQuoteAnnotationSchema = z.object({
	quote_id: z.string().uuid(),
	body: z.string().min(1),
	context: AnnotationContextSchema.optional(),
	tags: z.array(z.string()).optional(),
});

export const UpdateQuoteAnnotationSchema = z.object({
	body: z.string().min(1).optional(),
	context: AnnotationContextSchema.optional(),
	tags: z.array(z.string()).optional(),
});

// ─── Row shape actually returned by the quotes service ──────────────────
//
// Mirrors exactly the columns QUOTE_SELECT reads (lib/services/quotes.ts).
// QUOTE_SELECT is derived from this schema's keys. No joins for this entity.
export const QuoteRowSchema = z.object({
	id: z.string().uuid(),
	text: z.string(),
	page_number: z.number().nullable(),
	chapter: z.string().nullable(),
	source_type: QuoteSourceTypeSchema.nullable(),
	source_reference: z.string().nullable(),
	source_url: z.string().nullable(),
	source_author: z.string().nullable(),
	tags: z.array(z.string()),
	added_via: QuoteAddedViaSchema,
	last_surfaced_at: z.string().nullable(),
	created_at: z.string(),
});
export type QuoteRow = z.infer<typeof QuoteRowSchema>;

export const QUOTE_SELECT = Object.keys(QuoteRowSchema.shape).join(", ");

// ─── Row shape actually returned by the quote_annotations service ───────
//
// Mirrors exactly the columns QUOTE_ANNOTATION_SELECT reads
// (lib/services/quotes.ts). No joins for this entity.
export const QuoteAnnotationRowSchema = z.object({
	id: z.string().uuid(),
	quote_id: z.string().uuid(),
	body: z.string(),
	annotated_at: z.string(),
	context: AnnotationContextSchema,
	tags: z.array(z.string()),
	created_at: z.string(),
	updated_at: z.string(),
});
export type QuoteAnnotationRow = z.infer<typeof QuoteAnnotationRowSchema>;

export const QUOTE_ANNOTATION_SELECT = Object.keys(QuoteAnnotationRowSchema.shape).join(", ");
