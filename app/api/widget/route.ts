import { NextResponse } from "next/server";
import { todayInTz } from "@/lib/dates";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { getBriefing } from "@/lib/services/briefing";
import { getAppTimezone } from "@/lib/services/settings";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Widget feed (Phase 7) — compact read-only JSON for the iOS home-screen
// widget (Scriptable et al.), behind WIDGET_SECRET. A projection of the
// same briefing that renders the Today front page; read-only, so no ledger
// row (iron rule #6 covers actions, and this mutates nothing).
// ─────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
	if (!isAuthorized(request, env().WIDGET_SECRET)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}
	if (!isSupabaseConfigured()) {
		return NextResponse.json({ error: "not_configured" }, { status: 503 });
	}

	const sb = createAdminClient();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const briefing = await getBriefing(sb, tz, todayIso);

	return NextResponse.json(
		{
			date: todayIso,
			cadence: briefing.cadence.map((line) => ({ big: line.big, label: line.label })),
			inbox_count: briefing.inboxCount,
			doing_today: briefing.doingToday.map((t) => ({
				id: t.id,
				title: t.title,
				due_date: t.due_date,
			})),
			routines: {
				done: briefing.routines.done,
				total: briefing.routines.total,
				remaining: briefing.routines.remainingNames,
			},
			quote: briefing.quoteOfDay
				? { text: briefing.quoteOfDay.text, author: briefing.quoteOfDay.source_author }
				: null,
		},
		{ headers: { "cache-control": "no-store" } },
	);
}
