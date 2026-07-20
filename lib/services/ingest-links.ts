import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	type CreateIngestLinkInput,
	INGEST_LINK_SELECT,
	type IngestLinkRow,
	type IngestLinkStatus,
} from "@/lib/schemas/ingest-link";
import { unwrap, unwrapCount } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Link Ingest (docs/adr/0014) — the reading list at /ingest.
//
// Two clients, one service, per iron rule #3: pages and server actions pass
// an RLS-scoped `sb`, the secret-authed link API passes a service-role one.
// Nothing here runs the capture parser; a URL is stored as it arrived.
// ─────────────────────────────────────────────────────────────────────────

export type { CreateIngestLinkInput, IngestLinkRow, IngestLinkStatus };

/** Newest first, optionally narrowed to one read state. */
export async function listLinks(
	sb: SupabaseClient,
	opts: { status?: IngestLinkStatus; limit?: number } = {},
): Promise<IngestLinkRow[]> {
	let q = sb
		.from("ingest_links")
		.select(INGEST_LINK_SELECT)
		.order("created_at", { ascending: false });
	if (opts.status) q = q.eq("status", opts.status);
	if (opts.limit != null) q = q.limit(opts.limit);
	const data = unwrap(await q);
	return (data ?? []) as unknown as IngestLinkRow[];
}

/**
 * Store a shared link. Title and description are whatever the sender knew —
 * both optional, and neither is fetched or inferred here.
 */
export async function createLink(
	sb: SupabaseClient,
	input: CreateIngestLinkInput,
): Promise<IngestLinkRow> {
	const data = unwrap(
		await sb
			.from("ingest_links")
			.insert({
				url: input.url,
				title: input.title ?? null,
				description: input.description ?? null,
				source: input.source ?? null,
			})
			.select(INGEST_LINK_SELECT)
			.single(),
	);
	return data as unknown as IngestLinkRow;
}

/**
 * Set a link's read state. Every status is reachable from every other, so a
 * mis-tapped "read" can go straight back to unread.
 */
export async function setLinkStatus(
	sb: SupabaseClient,
	id: string,
	status: IngestLinkStatus,
): Promise<void> {
	unwrap(await sb.from("ingest_links").update({ status }).eq("id", id));
}

/** The Today alerts badge. */
export async function unreadLinkCount(sb: SupabaseClient): Promise<number> {
	return unwrapCount(
		await sb
			.from("ingest_links")
			.select("*", { count: "exact", head: true })
			.eq("status", "unread"),
	);
}
