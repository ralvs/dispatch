import { NextResponse } from "next/server";
import { z } from "zod";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { capture } from "@/lib/services/capture";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Ingest webhook (Phase 7) — the external capture surface for the Apple
// Watch / iOS share sheet. Secret-authed (iron rule #2), service-role client
// (iron rule #3), delegates to capture() so the never-lose guarantee (iron
// rule #4) applies unchanged, and writes a ledger row per external action
// (iron rule #6). Best-effort ledger: the capture itself is already durable
// and visible in the app, so a failed notification insert must not turn a
// successful capture into a 5xx for the caller.
// ─────────────────────────────────────────────────────────────────────────

const BodySchema = z.object({
	text: z.string().trim().min(1),
	via: z.enum(["voice", "text"]).default("text"),
	source: z.enum(["webhook", "watch"]).default("webhook"),
	client_time: z.string().optional(),
});

export async function POST(request: Request) {
	if (!isAuthorized(request, env().INGEST_WEBHOOK_SECRET)) {
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
	const record = await capture(sb, {
		kind: "transcript",
		text,
		via,
		source,
		clientTime: client_time,
	});

	try {
		await recordNotification(sb, {
			type: "ingest.captured",
			title: `Captured via ${source}`,
			body: text.length > 200 ? `${text.slice(0, 200)}…` : text,
			source_ref: record.capturedId,
		});
	} catch {
		// Capture is durable and already surfaced in-app; losing the ledger row
		// is the lesser failure and must not fail the webhook response.
	}

	return NextResponse.json(
		{
			id: record.capturedId,
			status: record.status,
			outcome: record.outcome.kind,
		},
		{ status: 201 },
	);
}
