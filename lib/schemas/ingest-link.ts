import { z } from "zod";

// The link reading list behind /ingest (docs/adr/0014). Three things share
// the word "inbox" in this product and none of them are this one: task
// triage lives at /triage, the system Inbox is a stewardship domain, and
// text capture is POST /api/ingest → captured_data.

export const IngestLinkStatusSchema = z.enum(["unread", "read", "dismissed"]);
export type IngestLinkStatus = z.infer<typeof IngestLinkStatusSchema>;

// An <a href> is a script sink, so the schema — not the renderer — is where
// a javascript:/data: payload gets turned away.
export const IngestLinkUrlSchema = z
	.url()
	.max(2048)
	.refine((u) => /^https?:\/\//i.test(u), { message: "Only http(s) links are accepted" });

export const CreateIngestLinkSchema = z.object({
	url: IngestLinkUrlSchema,
	title: z.string().trim().max(500).nullable().optional(),
	description: z.string().trim().max(5000).nullable().optional(),
	source: z.string().trim().max(100).nullable().optional(),
});
export type CreateIngestLinkInput = z.infer<typeof CreateIngestLinkSchema>;

// ─── Row shape actually returned by the ingest-links service ────────────
//
// INGEST_LINK_SELECT is derived from these keys (lib/services/ingest-links.ts).
// No joins for this entity.
export const IngestLinkRowSchema = z.object({
	id: z.string().uuid(),
	url: z.string(),
	title: z.string().nullable(),
	description: z.string().nullable(),
	status: IngestLinkStatusSchema,
	source: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});
export type IngestLinkRow = z.infer<typeof IngestLinkRowSchema>;

export const INGEST_LINK_SELECT = Object.keys(IngestLinkRowSchema.shape).join(", ");
