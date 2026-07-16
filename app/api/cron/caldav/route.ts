import { NextResponse } from "next/server";
import { createCaldavClient } from "@/lib/caldav/client";
import { nowUtc } from "@/lib/dates";
import { env, isCaldavConfigured, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { syncCalendar } from "@/lib/services/calendar";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV sync cron (docs/adr/0006) — invoked by cron-job.org behind
// CRON_SECRET. Pulls ±7 days from every calendar on the account and reports
// pulled/removed counts. A run that changed nothing writes no ledger row
// (iron rule #6 is about actions, not no-op ticks).
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

		if (result.pulled + result.removed > 0) {
			await recordNotification(sb, {
				type: "caldav.synced",
				title: `Calendar sync: ${result.pulled} pulled, ${result.removed} removed`,
			});
		}

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
