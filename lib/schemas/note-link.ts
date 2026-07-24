import { z } from "zod";

export const NoteLinkTargetTypeSchema = z.enum(["note", "task", "event"]);
export type NoteLinkTargetType = z.infer<typeof NoteLinkTargetTypeSchema>;

export const NoteLinkKindSchema = z.enum(["wikilink", "manual"]);
export type NoteLinkKind = z.infer<typeof NoteLinkKindSchema>;

// ─── Row shape actually returned by the note_links service ──────────────
export const NoteLinkRowSchema = z.object({
	id: z.string().uuid(),
	note_id: z.string().uuid(),
	target_type: NoteLinkTargetTypeSchema,
	target_note_id: z.string().uuid().nullable(),
	target_task_id: z.string().uuid().nullable(),
	target_event_id: z.string().uuid().nullable(),
	kind: NoteLinkKindSchema,
	created_at: z.string(),
});
export type NoteLinkRow = z.infer<typeof NoteLinkRowSchema>;

export const NOTE_LINK_SELECT = Object.keys(NoteLinkRowSchema.shape).join(", ");
