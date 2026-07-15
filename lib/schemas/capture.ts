import { z } from "zod";
import { NoteSourceTypeSchema } from "@/lib/schemas/note";

// ─────────────────────────────────────────────────────────────────────────
// Capture v1 contract (docs/adr/0008).
//
// Supersedes the 15-variant lib/schemas/voice.ts draft. v1 speaks only the
// verbs the executor can actually fulfil today — the tasks and notes services.
// Everything the reference vocabulary added (projects, quotes, people, journal,
// inventory, …) is deferred; the growth path is: add a service + an executor
// case + a variant here. The full reference vocabulary is recorded in the ADR
// and the reference impl stays linked in CLAUDE.md.
//
// Unknown/unsupported verbs the model might emit are NOT listed here, so they
// fail this schema during parsing (→ typed "failed" → degrade to a
// needs_review note) instead of reaching the executor and throwing at runtime.
// ─────────────────────────────────────────────────────────────────────────

// How the transcript was produced. 'voice' = spoken into the mic (Web Speech
// or, later, an audio-transcription seam). 'text' = typed into the palette.
export const CaptureTranscriptSourceSchema = z.enum(["voice", "text"]);
export type CaptureTranscriptSource = z.infer<typeof CaptureTranscriptSourceSchema>;

export const CaptureActionSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("create_task"),
		title: z.string().min(1),
		due_date: z.string().date().optional(),
		due_time: z.string().optional(),
		priority: z.number().int().min(1).max(4).optional(),
	}),
	z.object({
		action: z.literal("create_note"),
		body: z.string().min(1),
		source_type: NoteSourceTypeSchema.optional(),
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
