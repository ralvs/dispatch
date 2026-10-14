import { z } from "zod";
import type { Selected } from "@/lib/database";
import { formDecoder } from "@/lib/form-decode";

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
	entry_date: z.string().date("Pick a date."),
	transcription_text: z.string({ error: "Write the entry." }).min(1, "Write the entry."),
	source: JournalEntrySourceSchema.optional(),
	tags: z.array(z.string()).optional(),
});

/** The new-entry form's one decode, shared by the optimistic row and the server (docs/adr/0087). */
/**
 * The date a journal form picked, or null when it left the date blank
 * (absent, empty or whitespace). Both halves of a create use it, so they
 * agree on when the caller's today fills the date.
 */
export function pickedEntryDate(raw: FormDataEntryValue | null): string | null {
	if (typeof raw !== "string") return null;
	const date = raw.trim();
	return date === "" ? null : date;
}

export const createJournalEntryForm = formDecoder(CreateJournalEntrySchema, {
	spec: { tags: "list" },
});
export type CreateJournalEntryInput = z.output<typeof CreateJournalEntrySchema>;

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

// ─── Rows the journal service returns (lib/services/journal.ts) ─────────

export const JOURNAL_ENTRY_SELECT =
	"id, book_id, entry_date, image_path, transcription_text, source, tags, extracted_facts, attachments, resurface_weight, created_at" as const;
export type JournalEntryRow = Selected<"journal_entries", typeof JOURNAL_ENTRY_SELECT>;

export const JOURNAL_BOOK_SELECT =
	"id, book_number, start_date, end_date, notes, created_at" as const;
export type JournalBookRow = Selected<"journal_books", typeof JOURNAL_BOOK_SELECT>;
