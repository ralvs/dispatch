import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { sweepRawCaptures } from "@/lib/services/capture/sweep";
import { recordNotification } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Reconciliation sweep cron (Phase 7, docs/adr/0008) — invoked by
// cron-job.org behind CRON_SECRET. Degrades captured_data rows stuck at
// 'raw' into needs_review notes; never replays the pipeline. Writes a
// ledger row (iron rule #6) only when it actually acted — a no-op tick is
// not an action and would bury real notifications.
// ─────────────────────────────────────────────────────────────────────────

async function runSweep(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();
	const result = await sweepRawCaptures(sb);

	if (result.swept.length > 0 || result.reconciled.length > 0) {
		await recordNotification(sb, {
			type: "cron.sweep",
			title: `Sweep reconciled ${result.swept.length + result.reconciled.length} stuck capture(s)`,
			body:
				`${result.swept.length} degraded to needs_review, ` +
				`${result.reconciled.length} already had a linked note`,
		});
	}

	return NextResponse.json({
		swept: result.swept.length,
		reconciled: result.reconciled.length,
	});
}

// cron-job.org defaults to GET; POST kept for manual/scripted invocation.
export const GET = runSweep;
export const POST = runSweep;
