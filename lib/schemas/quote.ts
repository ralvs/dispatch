import { z } from "zod";
import type { Selected } from "@/lib/database";
import { formDecoder } from "@/lib/form-decode";

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
/** The values the `quotes.added_via` CHECK constraint accepts today. */
export type DbAddedVia = (typeof DB_ADDED_VIA)[number];

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

/** The add-quote form's one decode, shared by the optimistic row and the server (docs/adr/0087). */
export const createQuoteForm = formDecoder(CreateQuoteSchema, {
	spec: { tags: "list" },
	overrides: { added_via: "manual" },
});
export type CreateQuoteInput = z.output<typeof CreateQuoteSchema>;

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

// ─── Rows the quotes service returns (lib/services/quotes.ts) ───────────

export const QUOTE_SELECT =
	"id, text, page_number, chapter, source_type, source_reference, source_url, source_author, tags, added_via, last_surfaced_at, created_at" as const;
export type QuoteRow = Selected<"quotes", typeof QUOTE_SELECT>;

/** `context` is nullable in the DB. */
export const QUOTE_ANNOTATION_SELECT =
	"id, quote_id, body, annotated_at, context, tags, created_at, updated_at" as const;
export type QuoteAnnotationRow = Selected<"quote_annotations", typeof QUOTE_ANNOTATION_SELECT>;
