import { NextResponse } from "next/server";
import { createCaldavClient } from "@/lib/caldav/client";
import { env, isCaldavConfigured, isSupabaseConfigured } from "@/lib/env";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { isAuthorized } from "@/lib/secret-auth";
import { syncCalendar } from "@/lib/services/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV sync cron (docs/adr/0006) — invoked by cron-job.org behind
// CRON_SECRET. Pulls ±21 days from every calendar on the account. The
// calendar mirror writes caldav_sync_state and announces an outage once
// (docs/adr/0086); this route only turns its result into a response.
// ─────────────────────────────────────────────────────────────────────────

async function runCaldavSync(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isCaldavConfigured()) {
		return NextResponse.json({ error: "caldav_not_configured" }, { status: 503 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const result = await syncCalendar(createAdminClient(), createCaldavClient);
	if (!result.ok) return NextResponse.json({ error: "sync_failed" }, { status: 502 });

	// Only when rows actually moved — a quiet tick every few minutes must
	// not throw away a warm cache for nothing.
	if (result.pulled > 0 || result.removed > 0) afterExternalMutation(...EXTERNAL_WRITES.cronCaldav);

	return NextResponse.json({ pulled: result.pulled, removed: result.removed });
}

// cron-job.org defaults to GET; POST kept for manual/scripted invocation.
export const GET = runCaldavSync;
export const POST = runCaldavSync;
