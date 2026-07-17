import { z } from "zod";

// Notification ledger — iron rule #6: every autonomous/external action
// writes a row here. Mirrors exactly the `notifications` columns
// (supabase/migrations/0001_schema.sql). The table has no severity/category
// column — `type` is the free-text classifier and `status` is the read state.

export const NotificationStatusSchema = z.enum(["unread", "read", "dismissed"]);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

// Any JSON value — the honest domain of a jsonb column.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const JsonSchema: z.ZodType<Json> = z.lazy(() =>
	z.union([
		z.string(),
		z.number(),
		z.boolean(),
		z.null(),
		z.array(JsonSchema),
		z.record(z.string(), JsonSchema),
	]),
);

// ─── Row shape actually returned by the notifications service ──────────
//
// Mirrors exactly the columns NOTIFICATION_SELECT reads
// (lib/services/notifications.ts). No joins for this entity.
export const NotificationRowSchema = z.object({
	id: z.string().uuid(),
	type: z.string(),
	title: z.string(),
	body: z.string().nullable(),
	source_ref: z.string().nullable(),
	source_url: z.string().nullable(),
	status: NotificationStatusSchema,
	undo_payload: JsonSchema.nullable(),
	created_at: z.string(),
});
export type NotificationRow = z.infer<typeof NotificationRowSchema>;

export const NOTIFICATION_SELECT = Object.keys(NotificationRowSchema.shape).join(", ");
