import { NextResponse } from "next/server";
import { z } from "zod";
import { deriveReceipt } from "@/lib/capture/receipt";
import { env, isSupabaseConfigured } from "@/lib/env";
import { fetchLinkMetadata } from "@/lib/links/metadata";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/mutation-feedback/invalidate";
import { isAuthorized } from "@/lib/secret-auth";
import { capture } from "@/lib/services/capture";
import { createLink, updateLinkMetadata } from "@/lib/services/links";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// The one external capture surface (docs/adr/0022). Replaces POST /api/ingest
// and POST /api/links, which were split by payload shape and therefore forced
// the sender to classify before sending — the exact judgement call this app
// exists to remove. One endpoint, one secret, one Shortcut: post text.
//
// Routing is a property of the text, not of the URL you posted to:
//   a bare http(s) URL  → the reading list at /links, title/description resolved
//   anything else       → capture(), the parser pipeline (docs/adr/0008)
//
// "Bare" means the whole message is one URL. A sentence that merely contains a
// link ("read this before Friday: https://…") is a capture, not a bookmark —
// the parser keeps the URL in the task/note body.
//
// Shape as every external surface: secret-authed (iron rule #2), service-role
// client (iron rule #3), one ledger row per action (iron rule #6), and the
// ledger is best-effort (docs/adr/0015) — the row is already durable and
// visible in-app, so a failed notification must not turn success into a 5xx.
//
// Both replies carry `summary`: one English sentence naming what the text
// became. The Siri Shortcut speaks it, which is the only feedback a capture
// dictated to a watch ever gets — `outcome: "executed"` told the sender that
// something happened but never what.
// ─────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
	text: z.string().trim().min(1),
	via: z.enum(["voice", "text"]).default("text"),
	// Constrained to captured_data's `source` check constraint — the share
	// sheet posts as "webhook" rather than earning a value and a migration.
	source: z.enum(["webhook", "watch"]).default("webhook"),
	client_time: z.string().optional(),
});

/** The whole message is a single http(s) URL — no surrounding words. */
export function bareUrl(text: string): string | null {
	const trimmed = text.trim();
	if (/\s/.test(trimmed)) return null;
	if (!/^https?:\/\//i.test(trimmed)) return null;
	try {
		return new URL(trimmed).toString();
	} catch {
		return null;
	}
}

export async function POST(request: Request) {
	if (!isAuthorized(request, env().CAPTURE_WEBHOOK_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = BodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}
	const { text, via, source, client_time } = parsed.data;

	const sb = createAdminClient();
	const url = bareUrl(text);

	if (url) {
		// Persist first (iron rule #4): the row is the guarantee, the title is
		// a nicety. A crash during the fetch still leaves the URL on /links.
		const saved = await createLink(sb, { url, source });
		const tEnrich = performance.now();
		const meta = await fetchLinkMetadata(url);
		let link = saved;
		if (meta.title || meta.description) {
			try {
				link = await updateLinkMetadata(sb, saved.id, meta);
			} catch {
				// Bare row already exists; a missed title is the lesser loss.
			}
		}
		console.info("⏱ capture.link", {
			id: saved.id,
			enrich: Math.round(performance.now() - tEnrich),
		});
		const label = link.title ?? new URL(link.url).hostname;

		// The asymmetry this closes: the in-app capture action has always called
		// afterMutation; this, the external surface writing the same rows, never
		// invalidated anything (ADR-0035).
		afterExternalMutation(...EXTERNAL_WRITES.captureLink);

		try {
			await recordNotification(sb, {
				type: "capture.link",
				title: "Link saved",
				body: label,
				source_ref: link.id,
				source_url: link.url,
			});
		} catch {
			// Stored and already on /links; the ledger row is the lesser loss.
		}

		return NextResponse.json(
			{ kind: "link", id: link.id, status: link.status, summary: `Link saved: ${label}` },
			{ status: 201 },
		);
	}

	const record = await capture(sb, {
		kind: "transcript",
		text,
		via,
		source,
		clientTime: client_time,
	});

	// Whatever the parser decided — task, note, or a needs_review degradation —
	// it lands in one of these three. Cheap enough to name all of them.
	// capture.settled owns notes/quotes/journal tags; ledger is separate.
	afterExternalMutation(...EXTERNAL_WRITES.capture);

	try {
		await recordNotification(sb, {
			type: "capture.text",
			title: `Captured via ${source}`,
			body: text.length > 200 ? `${text.slice(0, 200)}…` : text,
			source_ref: record.capturedId,
		});
	} catch {
		// Capture is durable and already surfaced in-app.
	}

	return NextResponse.json(
		{
			kind: "capture",
			id: record.capturedId,
			status: record.status,
			outcome: record.outcome.kind,
			// The same receipt the palette renders, flattened to one line.
			summary: deriveReceipt(record).lines.join(" "),
		},
		{ status: 201 },
	);
}
