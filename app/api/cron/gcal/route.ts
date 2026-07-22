import { NextResponse } from "next/server";
import { nowUtc } from "@/lib/dates";
import { env, isGoogleCalendarConfigured, isSupabaseConfigured } from "@/lib/env";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { isAuthorized } from "@/lib/secret-auth";
import { syncGoogleCalendar } from "@/lib/services/google-calendar";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar pull cron (docs/adr/0018) — cron-job.org behind CRON_SECRET.
// calendar.readonly only. A no-op run writes no ledger row.
// ─────────────────────────────────────────────────────────────────────────

async function runGcalSync(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isGoogleCalendarConfigured()) {
		return NextResponse.json({ error: "gcal_not_configured" }, { status: 503 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();

	try {
		const conn = await createGoogleCalendarClient();
		const result = await syncGoogleCalendar(sb, conn);

		if (result.pulled + result.removed > 0) {
			await recordNotification(sb, {
				type: "gcal.synced",
				title: `Google Calendar sync: ${result.pulled} pulled, ${result.removed} removed`,
			});
		}

		return NextResponse.json(result);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await sb
			.from("google_sync_state")
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

export const GET = runGcalSync;
export const POST = runGcalSync;
