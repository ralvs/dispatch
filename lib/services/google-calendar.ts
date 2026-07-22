import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCalendarObject } from "@/lib/caldav/ical";
import { CALENDAR_SYNC_WINDOW_MS } from "@/lib/constants";
import { nowUtc } from "@/lib/dates";
import type { GoogleCalendarConnection } from "@/lib/google/client";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar pull-only via secret ICS feeds (docs/adr/0018). Reuses
// the CalDAV ICS parser. ±7 days, set-difference on source='google'.
// Never writes back to Google. No OAuth / GCP.
// ─────────────────────────────────────────────────────────────────────────

/** Postgres text-array literal for a `.not(col, "in", …)` filter. */
function inListLiteral(values: Iterable<string>): string {
	return `(${[...values].map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;
}

export async function syncGoogleCalendar(
	sb: SupabaseClient,
	conn: GoogleCalendarConnection,
	opts: { nowMs?: number } = {},
): Promise<{ pulled: number; removed: number }> {
	const nowMs = opts.nowMs ?? Date.now();
	const windowStartUtc = new Date(nowMs - CALENDAR_SYNC_WINDOW_MS).toISOString();
	const windowEndUtc = new Date(nowMs + CALENDAR_SYNC_WINDOW_MS).toISOString();
	const window = { startUtc: windowStartUtc, endUtc: windowEndUtc };
	const syncedAt = nowUtc(nowMs);

	const feeds = conn.listFeeds();
	if (feeds.length === 0) {
		throw new ServiceError("No Google ICS feeds configured", null);
	}

	const existingRows = (unwrap(
		await sb
			.from("calendar_events")
			.select("caldav_uid, caldav_etag, start_at")
			.eq("source", "google"),
	) ?? []) as { caldav_uid: string | null; caldav_etag: string | null; start_at: string }[];
	const knownByUid = new Map(
		existingRows.filter((r) => r.caldav_uid !== null).map((r) => [r.caldav_uid as string, r]),
	);

	let pulled = 0;
	let anySucceeded = false;
	const seenUids = new Set<string>();

	for (const feed of feeds) {
		let object: Awaited<ReturnType<GoogleCalendarConnection["fetchFeed"]>>;
		try {
			object = await conn.fetchFeed(feed.url);
		} catch {
			// One feed failed; keep going with the others.
			continue;
		}
		anySucceeded = true;

		const parsedEvents = parseCalendarObject(object.data, window);
		for (const parsed of parsedEvents) {
			seenUids.add(parsed.uid);
			const known = knownByUid.get(parsed.uid);
			// Feed-level etag: when the ICS body is unchanged, skip unless the
			// resolved start moved (RRULE window slide — same rule as CalDAV).
			if (
				known &&
				known.caldav_etag === object.etag &&
				Date.parse(known.start_at) === Date.parse(parsed.startUtc)
			) {
				continue;
			}

			unwrap(
				await sb.from("calendar_events").upsert(
					{
						caldav_uid: parsed.uid,
						caldav_etag: object.etag,
						caldav_href: feed.url,
						calendar_name: feed.name,
						title: parsed.title,
						description: parsed.description,
						start_at: parsed.startUtc,
						end_at: parsed.endUtc,
						all_day: parsed.allDay,
						location: parsed.location,
						attendees: parsed.attendees,
						source: "google",
						synced_at: syncedAt,
					},
					{ onConflict: "source,caldav_uid" },
				),
			);
			pulled++;
		}
	}

	if (!anySucceeded) {
		throw new ServiceError("All Google ICS feed fetches failed", null);
	}

	let removed = 0;
	if (seenUids.size > 0) {
		const deleted = unwrap(
			await sb
				.from("calendar_events")
				.delete()
				.eq("source", "google")
				.gte("start_at", windowStartUtc)
				.lt("start_at", windowEndUtc)
				.not("caldav_uid", "in", inListLiteral(seenUids))
				.select("id"),
		);
		removed = ((deleted as unknown[] | null) ?? []).length;
	}

	unwrap(
		await sb
			.from("google_sync_state")
			.upsert(
				{ id: true, last_synced_at: syncedAt, last_result: { pulled, removed } },
				{ onConflict: "id" },
			),
	);

	return { pulled, removed };
}
