import { NextResponse } from "next/server";
import { todayInTz } from "@/lib/dates";
import { env, isSupabaseConfigured } from "@/lib/env";
import { isAuthorized } from "@/lib/secret-auth";
import { getAppTimezone } from "@/lib/services/settings";
import { getToday } from "@/lib/services/today";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────
// Widget feed (Phase 7) — compact read-only JSON for the iOS home-screen
// widget (Scriptable et al.), behind WIDGET_SECRET. A projection of the
// same today that renders the Today front page; read-only, so no ledger
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
	const today = await getToday(sb, tz, todayIso);

	return NextResponse.json(
		{
			date: todayIso,
			cadence: today.cadence.map((line) => ({ big: line.big, label: line.label })),
			inbox_count: today.inboxCount,
			doing_today: today.doingToday.map((t) => ({
				id: t.id,
				title: t.title,
				due_date: t.due_date,
			})),
			routines: {
				done: today.routines.done,
				total: today.routines.total,
				remaining: today.routines.remainingNames,
			},
			quote: today.quoteOfDay
				? { text: today.quoteOfDay.text, author: today.quoteOfDay.source_author }
				: null,
		},
		{ headers: { "cache-control": "no-store" } },
	);
}
