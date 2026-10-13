import { NextResponse } from "next/server";
import { env, isCalendarBridgeConfigured, isSupabaseConfigured } from "@/lib/env";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { BridgeSyncBodySchema } from "@/lib/schemas/calendar";
import { isAuthorized } from "@/lib/secret-auth";
import { syncBridgeEvents } from "@/lib/services/calendar-bridge";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Mac EventKit bridge ingest (docs/adr/0018). Local launchd agent POSTs a
// ±21d snapshot from Apple Calendar (Engine Google calendars already synced
// there). Secret-authed; never talks to Google OAuth.
//
// The calendar mirror writes google_sync_state, announces an outage once,
// and marks it read on the next success (docs/adr/0080, docs/adr/0086).
// This route only turns its result into a response.
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

	const result = await syncBridgeEvents(createAdminClient(), {
		events: parsed.data.events,
		windowStart: parsed.data.window_start,
		windowEnd: parsed.data.window_end,
	});
	if (!result.ok) return NextResponse.json({ error: "sync_failed" }, { status: 502 });

	afterExternalMutation(...EXTERNAL_WRITES.calendarBridge);
	return NextResponse.json({ pulled: result.pulled, removed: result.removed });
}
