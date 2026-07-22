import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CALENDAR_SYNC_WINDOW_MS } from "@/lib/constants";
import { nowUtc } from "@/lib/dates";
import type { GoogleCalendarConnection } from "@/lib/google/client";
import { mapGoogleEvent } from "@/lib/google/map-event";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar pull-only sync (docs/adr/0018). ±7 days from every
// calendar the token can see. Cancellations: windowed set-difference on
// source='google' (cancelled remote events are never upserted). Never
// writes back to Google.
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

	const calendars = await conn.listCalendars();

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

	for (const calendar of calendars) {
		let remoteEvents: Awaited<ReturnType<GoogleCalendarConnection["listEventsInWindow"]>>;
		try {
			remoteEvents = await conn.listEventsInWindow(calendar.id, window);
		} catch {
			// One calendar failed; keep going with the others.
			continue;
		}
		anySucceeded = true;

		for (const remote of remoteEvents) {
			const mapped = mapGoogleEvent(remote);
			if (!mapped) continue;

			seenUids.add(mapped.uid);
			const known = knownByUid.get(mapped.uid);
			if (
				known &&
				known.caldav_etag === mapped.etag &&
				Date.parse(known.start_at) === Date.parse(mapped.startUtc)
			) {
				continue;
			}

			unwrap(
				await sb.from("calendar_events").upsert(
					{
						caldav_uid: mapped.uid,
						caldav_etag: mapped.etag,
						caldav_href: mapped.href,
						calendar_name: calendar.summary,
						title: mapped.title,
						description: mapped.description,
						start_at: mapped.startUtc,
						end_at: mapped.endUtc,
						all_day: mapped.allDay,
						location: mapped.location,
						attendees: mapped.attendees,
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
		throw new ServiceError("All Google Calendar fetches failed", null);
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
