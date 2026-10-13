import { z } from "zod";

export const MentionSourceTypeSchema = z.enum(["task", "note"]);
export type MentionSourceType = z.infer<typeof MentionSourceTypeSchema>;
