import { z } from "zod";
import { isRecurrenceRule } from "@/lib/recurrence";
import { NoteSourceTypeSchema } from "@/lib/schemas/note";
import { WallClockTimeSchema } from "@/lib/schemas/time";

// ─────────────────────────────────────────────────────────────────────────
// Capture v1 contract (docs/adr/0008).
//
// Supersedes the 15-variant lib/schemas/voice.ts draft. v1 speaks only the
// verbs the executor can actually fulfil today — tasks, events, notes,
// quotes, and journal entries. Everything else the reference
// vocabulary added (projects, people, inventory, …) is deferred; the growth
// path is: add a service + an executor case + a variant here. The full
// reference vocabulary is recorded in the ADR and the reference impl stays
// linked in AGENTS.md.
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

/**
 * A free-text field the model may fill with nothing useful. Measured against
 * the gateway, a small parser model answers an omitted `project` as `""`, `":"`
 * or `","` roughly two times in three — and because every one of those failed
 * `z.string().min(1)`, the WHOLE parse threw and the capture degraded to its
 * raw text. One junk optional field must never cost the title, the date, and
 * the domain that were all correct, so blank-and-punctuation-only answers are
 * normalised to "omitted" before validation rather than rejected.
 */
const OptionalText = z.preprocess((v) => {
	if (typeof v !== "string") return v;
	const trimmed = v.trim();
	// Nothing left once separators and quotes are removed → the model emitted a
	// placeholder, not an answer.
	return /[\p{L}\p{N}]/u.test(trimmed) ? trimmed : undefined;
}, z.string().min(1).optional());

export const CreateTaskActionSchema = z.object({
	action: z.literal("create_task"),
	title: z.string().min(1),
	notes: OptionalText,
	due_date: z.string().date().optional(),
	// Range-guarded (lib/schemas/time.ts), so a malformed time fails
	// schema-parse (→ typed failed → degrade) rather than reaching the executor.
	due_time: WallClockTimeSchema.optional(),
	priority: z.number().int().min(1).max(4).optional(),
	// Validated through lib/recurrence.ts so the LLM can never violate the DB
	// check constraint (docs/adr/0019) — the seven literals, or the custom
	// weekly form `weekly:tu,sa` (shape plan §06). Sharing the predicate rather
	// than re-listing the vocabulary is what keeps the two from drifting.
	// Unrepresentable cadences ("every 3 weeks") are omitted by the parser; the
	// phrase survives in `notes` instead.
	recurrence_rule: z
		.string()
		.refine(isRecurrenceRule, { message: "not a recurrence rule" })
		.optional(),
	// Names copied verbatim from the routing lists injected into the prompt —
	// never ids (docs/adr/0019 D1). Resolved server-side; no match → Inbox.
	domain: OptionalText,
	project: OptionalText,
});
export type CreateTaskAction = z.infer<typeof CreateTaskActionSchema>;

// Event times are wall-clock in the app timezone too; the executor converts to
// UTC via instantFromLocal (iron rule #1). Same guard as due_time, so a
// malformed time fails schema-parse rather than reaching CalDAV.
export const CreateEventActionSchema = z.object({
	action: z.literal("create_event"),
	title: z.string().min(1),
	start_date: z.string().date(),
	start_time: WallClockTimeSchema,
	// end_time is REQUIRED: the model picks the duration from context (a lunch
	// runs an hour, a standup fifteen minutes), because a fixed server-side
	// default would be wrong more often than the model is (docs/adr/0023).
	// end_date is only needed for an event crossing midnight.
	end_date: z.string().date().optional(),
	end_time: WallClockTimeSchema,
	location: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
});
export type CreateEventAction = z.infer<typeof CreateEventActionSchema>;

export const CaptureActionSchema = z.discriminatedUnion("action", [
	CreateTaskActionSchema,
	CreateEventActionSchema,
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
			.enum(["book", "article", "podcast", "video", "conversation", "other"])
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
