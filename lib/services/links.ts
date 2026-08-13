import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	type CreateLinkInput,
	LINK_SELECT,
	type LinkRow,
	type LinkStatus,
} from "@/lib/schemas/link";
import { unwrap, unwrapCount } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// The link reading list at /links (docs/adr/0014, renamed in docs/adr/0022).
//
// Two clients, one service, per iron rule #3: pages and server actions pass
// an RLS-scoped `sb`, the secret-authed capture API passes a service-role one.
// Nothing here runs the capture parser; a URL is stored as it arrived. Title
// and description are fetched by the caller (lib/links/metadata.ts), not here.
//
// `ingest_links` is the legacy table name and is deliberately not renamed
// (docs/adr/0022) — the word "ingest" survives in Postgres and nowhere else.
// ─────────────────────────────────────────────────────────────────────────

const TABLE = "ingest_links";

export type { CreateLinkInput, LinkRow, LinkStatus };

/** Newest first, optionally narrowed to one read state. */
export async function listLinks(
	sb: SupabaseClient,
	opts: { status?: LinkStatus; limit?: number } = {},
): Promise<LinkRow[]> {
	let q = sb.from(TABLE).select(LINK_SELECT).order("created_at", { ascending: false });
	if (opts.status) q = q.eq("status", opts.status);
	if (opts.limit != null) q = q.limit(opts.limit);
	const data = unwrap(await q);
	return (data ?? []) as unknown as LinkRow[];
}

/**
 * Store a shared link. Title and description are whatever the caller resolved
 * — both optional, and neither is fetched or inferred here.
 */
export async function createLink(sb: SupabaseClient, input: CreateLinkInput): Promise<LinkRow> {
	const data = unwrap(
		await sb
			.from(TABLE)
			.insert({
				url: input.url,
				title: input.title ?? null,
				description: input.description ?? null,
				source: input.source ?? null,
			})
			.select(LINK_SELECT)
			.single(),
	);
	return data as unknown as LinkRow;
}

/** Patch title/description after a persist-first save (POST /api/capture). */
export async function updateLinkMetadata(
	sb: SupabaseClient,
	id: string,
	meta: { title: string | null; description: string | null },
): Promise<LinkRow> {
	const data = unwrap(
		await sb
			.from(TABLE)
			.update({ title: meta.title, description: meta.description })
			.eq("id", id)
			.select(LINK_SELECT)
			.single(),
	);
	return data as unknown as LinkRow;
}

/**
 * Set a link's read state. Every status is reachable from every other, so a
 * mis-tapped "read" can go straight back to unread.
 */
export async function setLinkStatus(
	sb: SupabaseClient,
	id: string,
	status: LinkStatus,
): Promise<void> {
	unwrap(await sb.from(TABLE).update({ status }).eq("id", id));
}

/** The Today alerts badge. */
export async function unreadLinkCount(sb: SupabaseClient): Promise<number> {
	return unwrapCount(
		await sb.from(TABLE).select("*", { count: "exact", head: true }).eq("status", "unread"),
	);
}
