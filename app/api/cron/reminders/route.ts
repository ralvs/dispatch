import { NextResponse } from "next/server";
import { todayInTz } from "@/lib/dates";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { runTaskReminders } from "@/lib/services/reminders";
import { getAppTimezone } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Task reminders cron (docs/adr/0021) — invoked by cron-job.org every 5min
// behind CRON_SECRET, reusing the same secret sweep does (no new env var).
//
// Deliberately writes NO summary/tick notification: each delivered reminder
// already gets its own `reminder.fired` ledger row (iron rule #6), and a
// per-tick summary on top of that would double-count the same event twice
// in the ledger. Contrast with the sweep cron above, which only has an
// aggregate outcome to report and so writes one summary row per acting tick.
// ─────────────────────────────────────────────────────────────────────────

async function runReminders(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);

	const result = await runTaskReminders(sb, { tz, todayIso });

	return NextResponse.json(result);
}

// cron-job.org defaults to GET; POST kept for manual/scripted invocation.
export const GET = runReminders;
export const POST = runReminders;
