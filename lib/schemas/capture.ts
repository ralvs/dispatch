import { z } from "zod";
import { NoteSourceTypeSchema } from "@/lib/schemas/note";

// ─────────────────────────────────────────────────────────────────────────
// Capture v1 contract (docs/adr/0008).
//
// Supersedes the 15-variant lib/schemas/voice.ts draft. v1 speaks only the
// verbs the executor can actually fulfil today — tasks, notes, quotes,
// and journal entries. Everything else the reference
// vocabulary added (projects, people, inventory, …) is deferred; the growth
// path is: add a service + an executor case + a variant here. The full
// reference vocabulary is recorded in the ADR and the reference impl stays
// linked in CLAUDE.md.
//
// Unknown/unsupported verbs the model might emit are NOT listed here, so they
// fail this schema during parsing (→ typed "failed" → degrade to a
// needs_review note) instead of reaching the executor and throwing at runtime.
// ─────────────────────────────────────────────────────────────────────────

// How the text was produced. 'text' = typed (or pasted) into the palette.
// 'voice' is retained for external surfaces that already transcribed elsewhere
// (share sheet, watch, etc.) — Dispatch does not transcribe audio itself
// (docs/adr/0017).
export const CaptureTranscriptSourceSchema = z.enum(["voice", "text"]);
export type CaptureTranscriptSource = z.infer<typeof CaptureTranscriptSourceSchema>;

export const CaptureActionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("create_task"),
		title: z.string().min(1),
		due_date: z.string().date().optional(),
		// 24-hour HH:mm with valid ranges, so a malformed time fails schema-parse
		// (→ typed failed → degrade) rather than reaching the executor.
		due_time: z
			.string()
			.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
			.optional(),
		priority: z.number().int().min(1).max(4).optional(),
	}),
	z.object({
		action: z.literal("create_note"),
		body: z.string().min(1),
		source_type: NoteSourceTypeSchema.optional(),
		tags: z.array(z.string()).optional(),
	}),
	z.object({
		action: z.literal("create_quote"),
		text: z.string().min(1),
		source_type: z
			.enum(["book", "article", "podcast", "sermon", "video", "conversation", "other"])
			.nullable()
			.optional(),
		source_author: z.string().nullable().optional(),
		tags: z.array(z.string()).optional(),
	}),
	z.object({
		action: z.literal("create_journal_entry"),
		body: z.string().min(1),
		entry_date: z.string().date().optional(),
		tags: z.array(z.string()).optional(),
	}),
	z.object({
		// The parser flags content it can't confidently place — typically because
		// it mentions an entity (project, person, quote) v1 has no service for —
		// instead of guessing. The executor turns this into a needs_review note.
		action: z.literal("needs_review"),
		reason: z.string().min(1),
		proposed_kind: z.string().optional(),
	}),
]);
export type CaptureAction = z.infer<typeof CaptureActionSchema>;

// The parser returns an array of actions. One utterance can yield several
// (e.g. a task AND a note). An empty array means "nothing actionable" — the
// pipeline preserves the raw text as a plain note.
export const CaptureActionsSchema = z.array(CaptureActionSchema);

// Body accepted by the palette server action.
export const CaptureRequestSchema = z.object({
	text: z.string().min(1),
	via: CaptureTranscriptSourceSchema.optional(),
	// What the client believes the current local time is; the server falls back
	// to its own clock if absent.
	client_time: z.string().datetime({ offset: true }).optional(),
});
export type CaptureRequest = z.infer<typeof CaptureRequestSchema>;
