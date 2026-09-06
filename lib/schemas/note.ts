import { z } from "zod";

// Spec Addendum 02 §3 — notes use a finer-grained source_type instead of
// the old `type` enum. The type field has been removed entirely.

export const NoteSourceTypeSchema = z.enum([
	"own_thought",
	"reading_response",
	"meeting_note",
	"brainstorm",
	"observation",
	"other",
]);
export type NoteSourceType = z.infer<typeof NoteSourceTypeSchema>;

// File attachments — images, PDFs, and text files (docs/adr/0052). Same shape
// is available on journal_entries, which is not wired up yet. The schema is
// intentionally loose (everything optional except url/path/name) because the
// API trusts what it stored at upload time; the client never crafts these
// from scratch — it just adds/removes whole objects returned by
// POST /api/notes/[id]/attachments.
//
// `url` is an app-relative /api/media path, never a provider URL: the bucket
// is private and read through an owner-guarded proxy, so nothing persisted
// here names a storage provider and swapping provider cannot invalidate a
// stored row.
//
// The location fields are vestigial. They were specced for EXIF GPS, but
// downscaling calls sharp's .rotate(), which strips metadata — so they are
// never populated today. Left in place because they cost nothing and the
// column already holds the shape.
export const AttachmentSchema = z.object({
	url: z.string().min(1),
	storage_path: z.string().min(1),
	/** Original client filename. Display only — it never enters the storage key. */
	name: z.string().min(1),
	content_type: z.string().optional(),
	size_bytes: z.number().int().nonnegative().optional(),
	alt: z.string().nullable().optional(),
	uploaded_at: z.string().optional(),
	// GPS coordinates pulled from the image's EXIF, if present.
	gps: z
		.object({
			lat: z.number(),
			lon: z.number(),
		})
		.nullable()
		.optional(),
	// Human-readable address from reverse geocoding. Free-form — we
	// display it as-is, no parsing.
	location: z.string().nullable().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const NoteSchema = z.object({
	id: z.string().uuid(),
	title: z.string().nullable().optional(),
	body: z.string().min(1),
	source_type: NoteSourceTypeSchema,
	source_reference: z.string().nullable().optional(),
	tags: z.array(z.string()).default([]),
	// Optional, with no Inbox fallback — a loose thought stays loose
	// (shape plan D1). A note may carry a domain, a project, both or neither.
	domain_id: z.string().uuid().nullable().optional(),
	related_project_id: z.string().uuid().nullable().optional(),
	related_person_id: z.string().uuid().nullable().optional(),
	related_quote_id: z.string().uuid().nullable().optional(),
	needs_review: z.boolean().default(false),
	// Set when the note was degraded from a raw capture (docs/adr/0008); the
	// reconciliation sweep dedupes on it. Null for hand-authored notes.
	origin_capture_id: z.string().uuid().nullable().optional(),
	attachments: z.array(AttachmentSchema).default([]),
	created_at: z.string().datetime({ offset: true }),
});

export const CreateNoteSchema = z.object({
	title: z.string().nullable().optional(),
	body: z.string().min(1),
	source_type: NoteSourceTypeSchema.default("own_thought"),
	// Nullable so clients can clear a previously-set value via PATCH. The
	// alternative — omit the field — would update *only* the non-null fields,
	// making it impossible to wipe a source_reference once it's been set.
	source_reference: z.string().nullable().optional(),
	tags: z.array(z.string()).optional(),
	domain_id: z.string().uuid().nullable().optional(),
	related_project_id: z.string().uuid().nullable().optional(),
	related_person_id: z.string().uuid().nullable().optional(),
	related_quote_id: z.string().uuid().nullable().optional(),
	needs_review: z.boolean().optional(),
	origin_capture_id: z.string().uuid().nullable().optional(),
	attachments: z.array(AttachmentSchema).optional(),
});

export const UpdateNoteSchema = CreateNoteSchema.partial().extend({
	resurface_weight: z.number().min(0).optional(),
	pinned_at: z.string().datetime({ offset: true }).nullable().optional(),
});

// ─── Row shapes actually returned by the notes service ──────────────────
//
// Two selects: a narrow one for the write paths (capture pipeline only
// needs the id back) and a wider one for list/detail views. NoteRowSchema
// is the narrow shape; NoteListRowSchema extends it with the columns only
// the UI reads. NOTE_SELECT/NOTE_LIST_SELECT are derived from their keys
// (lib/services/notes.ts). No joins for this entity.
//
// `attachments` is on the list shape, not the narrow one: the capture
// pipeline is text-only (iron rule #4) and has no use for it, while both the
// note page and the list read it.
export const NoteRowSchema = z.object({
	id: z.string().uuid(),
	title: z.string().nullable(),
	body: z.string(),
	source_type: NoteSourceTypeSchema,
	needs_review: z.boolean(),
	tags: z.array(z.string()),
	origin_capture_id: z.string().uuid().nullable(),
	created_at: z.string(),
});
export type NoteRow = z.infer<typeof NoteRowSchema>;

export const NOTE_SELECT = Object.keys(NoteRowSchema.shape).join(", ");

export const NoteListRowSchema = NoteRowSchema.extend({
	source_reference: z.string().nullable(),
	domain_id: z.string().uuid().nullable(),
	related_project_id: z.string().uuid().nullable(),
	related_person_id: z.string().uuid().nullable(),
	related_quote_id: z.string().uuid().nullable(),
	pinned_at: z.string().nullable(),
	attachments: z.array(AttachmentSchema).default([]),
});
export type NoteListRow = z.infer<typeof NoteListRowSchema>;

export const NOTE_LIST_SELECT = Object.keys(NoteListRowSchema.shape).join(", ");
