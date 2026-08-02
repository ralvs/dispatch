import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unwrap } from "@/lib/services/errors";

// ─── Resurfacing skips ──────────────────────────────────────────────────
// The Today page's "Resurfaced" card lets the owner skip past today's pick
// (Next →) and undo the skips (Reset). Skips persist in resurfacing_seen —
// DB-backed rather than the reference's cookie so they follow the account
// across devices (docs/adr, Today redesign).

/** Quote ids dismissed today — pickResurfaced advances past these. */
export async function listSkippedToday(sb: SupabaseClient, todayIso: string): Promise<string[]> {
	const data = unwrap(
		await sb
			.from("resurfacing_seen")
			.select("item_id")
			.eq("item_type", "quote")
			.eq("surfaced_on", todayIso)
			.eq("user_response", "dismissed"),
	);
	return ((data ?? []) as Array<{ item_id: string }>).map((r) => r.item_id);
}

/** Record a "Next →" skip. Re-skipping the same quote on the same day is a no-op. */
export async function recordQuoteSkip(
	sb: SupabaseClient,
	quoteId: string,
	todayIso: string,
): Promise<void> {
	unwrap(
		await sb.from("resurfacing_seen").upsert(
			{
				item_type: "quote",
				item_id: quoteId,
				surfaced_on: todayIso,
				user_response: "dismissed",
			},
			{ onConflict: "item_type,item_id,surfaced_on" },
		),
	);
}

/** Reset: forget today's skips so the rotation starts over. */
export async function clearSkipsToday(sb: SupabaseClient, todayIso: string): Promise<void> {
	unwrap(
		await sb
			.from("resurfacing_seen")
			.delete()
			.eq("item_type", "quote")
			.eq("surfaced_on", todayIso)
			.eq("user_response", "dismissed"),
	);
}
