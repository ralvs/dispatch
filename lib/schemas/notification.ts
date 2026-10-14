import { z } from "zod";
import type { Selected } from "@/lib/database";

// Notification ledger — iron rule #6: every autonomous/external action
// writes a row here. Mirrors exactly the `notifications` columns
// (supabase/migrations/0001_schema.sql). The table has no severity/category
// column — `type` is the free-text classifier and `status` is the read state.

export const NotificationStatusSchema = z.enum(["unread", "read", "dismissed"]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

// ─── Row shape actually returned by the notifications service ──────────
//
// Mirrors exactly the columns NOTIFICATION_SELECT reads
// (lib/services/notifications.ts). No joins for this entity.
export const NOTIFICATION_SELECT =
	"id, type, title, body, source_ref, source_url, status, created_at" as const;
export type NotificationRow = Selected<"notifications", typeof NOTIFICATION_SELECT>;
