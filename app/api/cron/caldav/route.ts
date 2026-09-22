import { NextResponse } from "next/server";
import { createCaldavClient } from "@/lib/caldav/client";
import { nowUtc } from "@/lib/dates";
import { env, isCaldavConfigured, isSupabaseConfigured } from "@/lib/env";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/mutation-feedback/invalidate";
import { isAuthorized } from "@/lib/secret-auth";
import { syncCalendar } from "@/lib/services/calendar";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV sync cron (docs/adr/0006) — invoked by cron-job.org behind
// CRON_SECRET. Pulls ±21 days from every calendar on the account and reports
// pulled/removed counts. Silent on both success and failure — the sync
// state is durable in caldav_sync_state; nothing here writes a ledger row.
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

	const sb = createAdminClient();

	try {
		const conn = await createCaldavClient();
		const result = await syncCalendar(sb, conn);

		// Only when rows actually moved — a quiet tick every few minutes must
		// not throw away a warm cache for nothing.
		if (result.pulled > 0 || result.removed > 0)
			afterExternalMutation(...EXTERNAL_WRITES.cronCaldav);

		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		// Best-effort: still record the failed state on the singleton so the
		// next successful run (and any future status UI) can see it happened.
		await sb
			.from("caldav_sync_state")
			.upsert(
				{ id: true, last_synced_at: nowUtc(), last_result: { error: message } },
				{ onConflict: "id" },
			)
			.then(
				() => {},
				() => {},
			);

		return NextResponse.json({ error: "sync_failed" }, { status: 502 });
	}
}

// cron-job.org defaults to GET; POST kept for manual/scripted invocation.
export const GET = runCaldavSync;
export const POST = runCaldavSync;
