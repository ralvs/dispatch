import { z } from "zod";
import type { Selected } from "@/lib/database";

export const NoteLinkTargetTypeSchema = z.enum(["note", "task", "event"]);
export type NoteLinkTargetType = z.infer<typeof NoteLinkTargetTypeSchema>;

export const NoteLinkKindSchema = z.enum(["wikilink", "manual"]);
export type NoteLinkKind = z.infer<typeof NoteLinkKindSchema>;

// ─── Row shape actually returned by the note_links service ──────────────
export const NOTE_LINK_SELECT =
	"id, note_id, target_type, target_note_id, target_task_id, target_event_id, kind, created_at" as const;
export type NoteLinkRow = Selected<"note_links", typeof NOTE_LINK_SELECT>;
