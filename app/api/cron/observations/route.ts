import { NextResponse } from "next/server";
import { env, isSupabaseConfigured } from "@/lib/env";
import { afterExternalMutation } from "@/lib/mutation-feedback/invalidate";
import { isAuthorized } from "@/lib/secret-auth";
import { recordNotification } from "@/lib/services/notifications";
import { sweepNeglect } from "@/lib/services/observations";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Neglect sweep cron (docs/plan-dispatch-shape-2026-08-21.html §04) —
// invoked by cron-job.org behind CRON_SECRET, modelled on
// app/api/cron/sweep/route.ts. Flags a domain whose last touch is older than
// its own "flag after N days" rule, and resolves the flag once it is touched
// again.
//
// Writes a ledger row (iron rule #6) only when it actually flagged something.
// A tick that found nothing writes nothing — a ledger of "all fine" rows
// buries the one that matters. Resolving a stale flag is housekeeping, not an
// action worth a notification.
// ─────────────────────────────────────────────────────────────────────────

async function runObservations(request: Request) {
	if (!isAuthorized(request, env().CRON_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();
	const result = await sweepNeglect(sb);

	if (result.flagged.length > 0) {
		// The bell gains a row and /domains gains quiet dots.
		afterExternalMutation("notification.write");

		const names = result.flagged.map((d) => d.name).join(", ");
		await recordNotification(sb, {
			type: "cron.observations",
			title: `${result.flagged.length} domain(s) have gone quiet`,
			body: names,
			source_url: "/domains",
		});
	}

	return NextResponse.json({
		flagged: result.flagged.length,
		resolved: result.resolved,
	});
}

// cron-job.org defaults to GET; POST kept for manual/scripted invocation.
export const GET = runObservations;
export const POST = runObservations;
