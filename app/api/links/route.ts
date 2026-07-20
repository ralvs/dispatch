import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { CreateIngestLinkSchema } from "@/lib/schemas/ingest-link";
import { isAuthorized } from "@/lib/secret-auth";
import { createLink } from "@/lib/services/ingest-links";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Link share endpoint (docs/adr/0014) — the share sheet's other half.
//
// Deliberately NOT part of POST /api/ingest: that path runs free text
// through the LLM capture parser, and a bare URL has nothing to parse. A
// link is stored exactly as it arrived and read later.
//
// Same shape as every other external surface: secret-authed (iron rule #2),
// service-role client (iron rule #3), ledger row per external action (iron
// rule #6). It shares INGEST_WEBHOOK_SECRET with the text webhook — same
// sender, same device, one secret to rotate — and is separated by path, as
// the ADR requires.
//
// Best-effort ledger: the link is already durable and visible at /ingest, so
// a failed notification insert must not turn a saved link into a 5xx.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
	if (!isAuthorized(request, env().INGEST_WEBHOOK_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = CreateIngestLinkSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}

	const source = parsed.data.source ?? "api";
	const sb = createAdminClient();
	const link = await createLink(sb, { ...parsed.data, source });

	try {
		await recordNotification(sb, {
			type: "ingest.link",
			title: `Link via ${source}`,
			body: link.title ? `${link.title} — ${link.url}` : link.url,
			source_ref: link.id,
			source_url: link.url,
		});
	} catch {
		// The link is stored and already on /ingest; losing the ledger row is
		// the lesser failure and must not fail the caller's request.
	}

	return NextResponse.json({ id: link.id, status: link.status }, { status: 201 });
}
