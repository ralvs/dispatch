import { z } from "zod";

export const MentionSourceTypeSchema = z.enum(["task", "note"]);
export type MentionSourceType = z.infer<typeof MentionSourceTypeSchema>;

// ─── Row shape actually returned by the mentions service ────────────────
export const MentionRowSchema = z.object({
	id: z.string().uuid(),
	person_id: z.string().uuid(),
	task_id: z.string().uuid().nullable(),
	note_id: z.string().uuid().nullable(),
	source_type: MentionSourceTypeSchema,
	matched_name: z.string(),
	created_at: z.string(),
});
export type MentionRow = z.infer<typeof MentionRowSchema>;

export const MENTION_SELECT = Object.keys(MentionRowSchema.shape).join(", ");
