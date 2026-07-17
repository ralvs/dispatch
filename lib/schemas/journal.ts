import { z } from "zod";

// Journal = daily diary entries, optionally grouped into physical/digital
// "books". v1 is text-only (docs/adr for Phase 4): image_path, attachments,
// and OCR extraction are deferred — those columns keep their DB defaults and
// are never written here.

export const JournalEntrySourceSchema = z.enum(["handwritten_photo", "voice", "typed"]);
export type JournalEntrySource = z.infer<typeof JournalEntrySourceSchema>;

export const JournalEntrySchema = z.object({
	id: z.string().uuid(),
	book_id: z.string().uuid().nullable().optional(),
	entry_date: z.string().date(),
	image_path: z.string().nullable().optional(),
	transcription_text: z.string().nullable().optional(),
	source: JournalEntrySourceSchema.default("typed"),
	tags: z.array(z.string()).default([]),
	extracted_facts: z.record(z.string(), z.unknown()).default({}),
	attachments: z.array(z.unknown()).default([]),
	resurface_weight: z.number().min(0).default(1.0),
	created_at: z.string().datetime({ offset: true }),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const CreateJournalEntrySchema = z.object({
	book_id: z.string().uuid().nullable().optional(),
	entry_date: z.string().date(),
	transcription_text: z.string().min(1),
	source: JournalEntrySourceSchema.optional(),
	tags: z.array(z.string()).optional(),
});

export const UpdateJournalEntrySchema = z.object({
	book_id: z.string().uuid().nullable().optional(),
	entry_date: z.string().date().optional(),
	transcription_text: z.string().min(1).optional(),
	tags: z.array(z.string()).optional(),
});

export const JournalBookSchema = z.object({
	id: z.string().uuid(),
	book_number: z.number().int(),
	start_date: z.string().date().nullable().optional(),
	end_date: z.string().date().nullable().optional(),
	notes: z.string().nullable().optional(),
	created_at: z.string().datetime({ offset: true }),
});
export type JournalBook = z.infer<typeof JournalBookSchema>;

// ─── Row shape actually returned by the journal entries service ────────
//
// Mirrors exactly the columns JOURNAL_ENTRY_SELECT reads
// (lib/services/journal.ts). No joins for this entity.
export const JournalEntryRowSchema = z.object({
	id: z.string().uuid(),
	book_id: z.string().uuid().nullable(),
	entry_date: z.string(),
	image_path: z.string().nullable(),
	transcription_text: z.string().nullable(),
	source: JournalEntrySourceSchema,
	tags: z.array(z.string()),
	extracted_facts: z.record(z.string(), z.unknown()),
	attachments: z.array(z.unknown()),
	resurface_weight: z.number(),
	created_at: z.string(),
});
export type JournalEntryRow = z.infer<typeof JournalEntryRowSchema>;

export const JOURNAL_ENTRY_SELECT = Object.keys(JournalEntryRowSchema.shape).join(", ");

// ─── Row shape actually returned by the journal books service ──────────
//
// Mirrors exactly the columns JOURNAL_BOOK_SELECT reads
// (lib/services/journal.ts). No joins for this entity.
export const JournalBookRowSchema = z.object({
	id: z.string().uuid(),
	book_number: z.number(),
	start_date: z.string().nullable(),
	end_date: z.string().nullable(),
	notes: z.string().nullable(),
	created_at: z.string(),
});
export type JournalBookRow = z.infer<typeof JournalBookRowSchema>;

export const JOURNAL_BOOK_SELECT = Object.keys(JournalBookRowSchema.shape).join(", ");
