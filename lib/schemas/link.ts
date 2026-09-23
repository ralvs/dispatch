import { z } from "zod";

// The link reading list behind /links (docs/adr/0014, renamed in docs/adr/0022).
// The word "ingest" used to name three unrelated things; it is gone now, and
// so is "triage" (docs/adr/0024). Unfiled tasks are the Inbox at /inbox;
// free-text capture is POST /api/capture → captured_data.
//
// The `ingest_links` TABLE keeps its name — renaming it would be a migration
// over live rows for no functional gain (docs/adr/0022).

export const LinkStatusSchema = z.enum(["unread", "read", "dismissed"]);
export type LinkStatus = z.infer<typeof LinkStatusSchema>;

// An <a href> is a script sink, so the schema — not the renderer — is where
// a javascript:/data: payload gets turned away.
export const LinkUrlSchema = z
	.url()
	.max(2048)
	.refine((u) => /^https?:\/\//i.test(u), { message: "Only http(s) links are accepted" });

export const CreateLinkSchema = z.object({
	url: LinkUrlSchema,
	title: z.string().trim().max(500).nullable().optional(),
	description: z.string().trim().max(5000).nullable().optional(),
	source: z.string().trim().max(100).nullable().optional(),
});
export type CreateLinkInput = z.infer<typeof CreateLinkSchema>;

// ─── Row shape actually returned by the links service ───────────────────
//
// LINK_SELECT is derived from these keys (lib/services/links.ts).
// No joins for this entity.
export const LinkRowSchema = z.object({
	id: z.string().uuid(),
	url: z.string(),
	title: z.string().nullable(),
	description: z.string().nullable(),
	// A hotlinked preview (docs/adr/0066) — the publisher's URL, never a copy.
	image_url: z.string().nullable(),
	status: LinkStatusSchema,
	source: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});
export type LinkRow = z.infer<typeof LinkRowSchema>;

export const LINK_SELECT = Object.keys(LinkRowSchema.shape).join(", ");
