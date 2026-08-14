import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaldavConnection } from "@/lib/caldav/client";
import { parseCalendarObject } from "@/lib/caldav/ical";
import { CALENDAR_SYNC_WINDOW_MS } from "@/lib/constants";
import { dayWindowUtc, nowUtc, shiftDay } from "@/lib/dates";
import { eventFallsOnDay } from "@/lib/day-schedule";
import { env } from "@/lib/env";
import { type CalendarEventRow, EVENT_SELECT } from "@/lib/schemas/calendar";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV sync (docs/adr/0006). Pulls VEVENTs ±21 days from every
// calendar on the account; app-created events push only to the calendar
// named `ICLOUD_CALENDAR_NAME`. Cancellation detection is a windowed
// set-difference on `caldav_uid` — CalDAV has no tombstones, so a caldav
// row that falls inside the window but wasn't seen on this sync is gone.
// Identity is unique on (source, caldav_uid) after docs/adr/0018.
// ─────────────────────────────────────────────────────────────────────────

export type { CalendarEventRow };

/** Postgres text-array literal for a `.not(col, "in", …)` filter, quoted per value. */
function inListLiteral(values: Iterable<string>): string {
	return `(${[...values].map((v) => `"${v.replace(/"/g, '\\"')}"`).join(",")})`;
}

export async function syncCalendar(
	sb: SupabaseClient,
	conn: CaldavConnection,
	opts: { nowMs?: number } = {},
): Promise<{ pulled: number; removed: number }> {
	const nowMs = opts.nowMs ?? Date.now();
	const windowStartUtc = new Date(nowMs - CALENDAR_SYNC_WINDOW_MS).toISOString();
	const windowEndUtc = new Date(nowMs + CALENDAR_SYNC_WINDOW_MS).toISOString();
	const window = { startUtc: windowStartUtc, endUtc: windowEndUtc };
	const syncedAt = nowUtc(nowMs);

	const calendars = await conn.listCalendars();

	// Known caldav rows, so unchanged events (same etag AND same resolved start
	// — a recurring event's start advances as the window slides, etag doesn't)
	// skip their upsert. Keeps `pulled` meaning "new or changed", so a quiet
	// sync writes no rows, no ledger entry, and sends no push.
	const existingRows = (unwrap(
		await sb
			.from("calendar_events")
			.select("caldav_uid, caldav_etag, start_at")
			.eq("source", "caldav"),
	) ?? []) as { caldav_uid: string | null; caldav_etag: string | null; start_at: string }[];
	const knownByUid = new Map(
		existingRows.filter((r) => r.caldav_uid !== null).map((r) => [r.caldav_uid as string, r]),
	);

	let pulled = 0;
	let anySucceeded = false;
	const seenUids = new Set<string>();

	for (const calendar of calendars) {
		let objects: Awaited<ReturnType<CaldavConnection["fetchObjectsInWindow"]>>;
		try {
			objects = await conn.fetchObjectsInWindow(calendar.url, window);
		} catch {
			// This calendar failed to fetch; keep going with the others rather
			// than aborting the whole sync.
			continue;
		}
		anySucceeded = true;

		for (const object of objects) {
			const parsedEvents = parseCalendarObject(object.data, window);
			for (const parsed of parsedEvents) {
				seenUids.add(parsed.uid);
				const known = knownByUid.get(parsed.uid);
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
							caldav_href: object.href,
							calendar_name: calendar.displayName,
							title: parsed.title,
							description: parsed.description,
							start_at: parsed.startUtc,
							end_at: parsed.endUtc,
							all_day: parsed.allDay,
							location: parsed.location,
							attendees: parsed.attendees,
							source: "caldav",
							synced_at: syncedAt,
						},
						{ onConflict: "source,caldav_uid" },
					),
				);
				pulled++;
			}
		}
	}

	// Never mass-delete on a dead connection: if every calendar fetch failed,
	// the "seen" set is meaningless and can't be trusted for set-difference.
	if (!anySucceeded) {
		throw new ServiceError("All CalDAV calendar fetches failed", null);
	}

	let removed = 0;
	// Only run the set-difference delete when we actually saw events this
	// sync — an empty seen set is treated as "nothing to compare against"
	// rather than "delete everything in the window".
	if (seenUids.size > 0) {
		const deleted = unwrap(
			await sb
				.from("calendar_events")
				.delete()
				.eq("source", "caldav")
				.gte("start_at", windowStartUtc)
				.lt("start_at", windowEndUtc)
				.not("caldav_uid", "in", inListLiteral(seenUids))
				.select("id"),
		);
		removed = ((deleted as unknown[] | null) ?? []).length;
	}

	unwrap(
		await sb
			.from("caldav_sync_state")
			.upsert(
				{ id: true, last_synced_at: syncedAt, last_result: { pulled, removed } },
				{ onConflict: "id" },
			),
	);

	return { pulled, removed };
}

export async function listEventsOn(
	sb: SupabaseClient,
	dateIso: string,
	tz: string,
): Promise<CalendarEventRow[]> {
	// A day wider on each side than the day being asked for. An all-day event
	// carries dates encoded as instants (lib/day-schedule.ts), and that encoding
	// can land its midnight outside this timezone's day in either direction, so
	// SQL can only be trusted to narrow — `eventFallsOnDay` is what decides.
	const { startUtc } = dayWindowUtc(shiftDay(dateIso, -1), tz);
	const { endUtc } = dayWindowUtc(shiftDay(dateIso, 1), tz);
	const data = unwrap(
		await sb
			.from("calendar_events")
			.select(EVENT_SELECT)
			.lt("start_at", endUtc)
			.gt("end_at", startUtc)
			.order("start_at", { ascending: true }),
	);
	const rows = (data ?? []) as unknown as CalendarEventRow[];
	return rows.filter((event) => eventFallsOnDay(event, dateIso, tz));
}

export async function getEvent(sb: SupabaseClient, id: string): Promise<CalendarEventRow | null> {
	const data = unwrap(
		await sb.from("calendar_events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
	);
	return (data as unknown as CalendarEventRow | null) ?? null;
}

/** Escapes ilike wildcards so a search term is matched literally. */
function escapeLike(q: string): string {
	return q.replace(/[%_\\]/g, (m) => `\\${m}`);
}

export type EventSearchResult = {
	id: string;
	title: string;
	start_at: string;
};

/** Title search for the note link picker — most recent first. */
export async function searchEventsByTitle(
	sb: SupabaseClient,
	q: string,
	limit = 8,
): Promise<EventSearchResult[]> {
	const data = unwrap(
		await sb
			.from("calendar_events")
			.select("id, title, start_at")
			.ilike("title", `%${escapeLike(q)}%`)
			.order("start_at", { ascending: false })
			.limit(limit),
	);
	return (data ?? []) as unknown as EventSearchResult[];
}

export type CreateEventHereInput = {
	title: string;
	startUtc: string;
	endUtc: string;
	description?: string;
	location?: string;
};

/** `YYYY-MM-DDTHH:mm:ssZ` — iCal's basic UTC datetime form, from an ISO instant. */
function toIcalUtc(isoInstant: string): string {
	return isoInstant.replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
}

function buildVevent(uid: string, input: CreateEventHereInput, nowIso: string): string {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Dispatch//EN",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${toIcalUtc(nowIso)}`,
		`DTSTART:${toIcalUtc(input.startUtc)}`,
		`DTEND:${toIcalUtc(input.endUtc)}`,
		`SUMMARY:${input.title}`,
	];
	if (input.description) lines.push(`DESCRIPTION:${input.description}`);
	if (input.location) lines.push(`LOCATION:${input.location}`);
	lines.push("END:VEVENT", "END:VCALENDAR");
	return lines.join("\r\n");
}

/**
 * Creates an event on the CalDAV calendar named `ICLOUD_CALENDAR_NAME`
 * (ADR-0006's single push target), then mirrors it locally with
 * source='created_here'. No UI calls this yet.
 */
export async function createEventHere(
	sb: SupabaseClient,
	conn: CaldavConnection,
	input: CreateEventHereInput,
): Promise<CalendarEventRow> {
	const calendarName = env().ICLOUD_CALENDAR_NAME;
	const calendars = await conn.listCalendars();
	const target = calendars.find((c) => c.displayName === calendarName);
	if (!target) {
		throw new ServiceError(`iCloud calendar "${calendarName}" was not found`, null);
	}

	const uid = randomUUID();
	const nowIso = nowUtc();
	await conn.createObject(target.url, `${uid}.ics`, buildVevent(uid, input, nowIso));

	const data = unwrap(
		await sb
			.from("calendar_events")
			.insert({
				caldav_uid: uid,
				calendar_name: target.displayName,
				title: input.title,
				description: input.description ?? null,
				location: input.location ?? null,
				start_at: input.startUtc,
				end_at: input.endUtc,
				all_day: false,
				attendees: [],
				source: "created_here",
				synced_at: nowIso,
			})
			.select(EVENT_SELECT)
			.single(),
	);
	return data as unknown as CalendarEventRow;
}
