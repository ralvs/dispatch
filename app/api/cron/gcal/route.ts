import { NextResponse } from "next/server";
import { nowUtc } from "@/lib/dates";
import { env, isGoogleOAuthConfigured, isSupabaseConfigured } from "@/lib/env";
import { createGoogleCalendarClient } from "@/lib/google/client";
import { isAuthorized } from "@/lib/secret-auth";
import { getGoogleRefreshToken } from "@/lib/services/google-auth";
import { syncGoogleCalendar } from "@/lib/services/google-calendar";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar pull cron (docs/adr/0018) — cron-job.org behind CRON_SECRET.
// Requires OAuth app env + a connected refresh_token in google_sync_state.
// ─────────────────────────────────────────────────────────────────────────

async function runGcalSync(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isGoogleOAuthConfigured()) {
		return NextResponse.json({ error: "gcal_oauth_not_configured" }, { status: 503 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();
	const refreshToken = await getGoogleRefreshToken(sb);
	if (!refreshToken) {
		return NextResponse.json({ error: "gcal_not_connected" }, { status: 503 });
	}

	try {
		const conn = await createGoogleCalendarClient(refreshToken);
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
		const existing = await sb
			.from("google_sync_state")
			.select("refresh_token, account_email, connected_at")
			.eq("id", true)
			.maybeSingle();
		await sb
			.from("google_sync_state")
			.upsert(
				{
					id: true,
					last_synced_at: nowUtc(),
					last_result: { error: message },
					refresh_token: existing.data?.refresh_token ?? null,
					account_email: existing.data?.account_email ?? null,
					connected_at: existing.data?.connected_at ?? null,
				},
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
