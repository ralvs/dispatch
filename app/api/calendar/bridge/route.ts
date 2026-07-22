import { NextResponse } from "next/server";
import { env, isCalendarBridgeConfigured, isSupabaseConfigured } from "@/lib/env";
import { BridgeSyncBodySchema } from "@/lib/schemas/calendar";
import { isAuthorized } from "@/lib/secret-auth";
import { syncBridgeEvents } from "@/lib/services/calendar-bridge";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Mac EventKit bridge ingest (docs/adr/0018). Local launchd agent POSTs a
// ±7d snapshot from Apple Calendar (Engine Google calendars already synced
// there). Secret-authed; never talks to Google OAuth.
//
// Quiet on success — a 15m bridge would otherwise spam the ledger/push.
// Failures still write a notification so the owner hears about it.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
	if (!isAuthorized(request, env().CALENDAR_BRIDGE_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isCalendarBridgeConfigured() || !isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const json = await request.json().catch(() => null);
	const parsed = BridgeSyncBodySchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "invalid_request" }, { status: 400 });
	}

	const sb = createAdminClient();

	try {
		const result = await syncBridgeEvents(sb, {
			events: parsed.data.events,
			windowStart: parsed.data.window_start,
			windowEnd: parsed.data.window_end,
		});
		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		try {
			await recordNotification(sb, {
				type: "gcal.sync_failed",
				title: "Calendar bridge failed",
				body: message.slice(0, 500),
			});
		} catch {
			// Best-effort ledger (ADR-0015).
		}
		return NextResponse.json({ error: "sync_failed" }, { status: 502 });
	}
}
