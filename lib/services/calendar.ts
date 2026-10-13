import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type CaldavConnection, changedSinceSyncError } from "@/lib/caldav/client";
import {
	assertSingleEvent,
	buildEventObject,
	type EventPatch,
	EventPatchError,
	parseCalendarObject,
	patchEventObject,
} from "@/lib/caldav/ical";
import { whyNotEditable } from "@/lib/calendar-edit";
import { CALENDAR_SYNC_WINDOW_MS } from "@/lib/constants";
import { dayWindowUtc, nowUtc, shiftDay } from "@/lib/dates";
import { eventFallsOnDay, eventFallsOnDays } from "@/lib/day-schedule";
import { env } from "@/lib/env";
import { escapeLike } from "@/lib/like";
import { type CalendarEventRow, EVENT_SELECT } from "@/lib/schemas/calendar";
import {
	type MirrorEvent,
	type MirrorResult,
	type MirrorSnapshot,
	syncFeed,
} from "@/lib/services/calendar-mirror";
import { ServiceError, unwrap } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV (docs/adr/0006). Reads VEVENTs ±21 days from every
// calendar on the account into a snapshot; the calendar mirror reconciles it
// and keeps the sync state (docs/adr/0086). App-created events push only to
// the calendar named `ICLOUD_CALENDAR_NAME`, the write calendar
// (docs/adr/0082), and only single events there may be edited or deleted.
// An event Dispatch created keeps its one `created_here` row, matched on UID.
// ─────────────────────────────────────────────────────────────────────────

export type { CalendarEventRow };

/**
 * Pull iCloud into the mirror (docs/adr/0086). The connection opens inside
 * the read, so a login failure is recorded like any other failed sync.
 */
export async function syncCalendar(
	sb: SupabaseClient,
	connect: () => Promise<CaldavConnection>,
	opts: { nowMs?: number } = {},
): Promise<MirrorResult> {
	const nowMs = opts.nowMs ?? Date.now();
	return syncFeed(sb, "icloud", async () => readIcloudSnapshot(await connect(), nowMs), { nowMs });
}

/**
 * Every calendar's events in the ±21 day window. One calendar that fails to
 * answer is left out — the snapshot speaks only for the calendars that did.
 * When none answers the read fails: a dead connection is not an empty window.
 */
async function readIcloudSnapshot(conn: CaldavConnection, nowMs: number): Promise<MirrorSnapshot> {
	const window = {
		startUtc: new Date(nowMs - CALENDAR_SYNC_WINDOW_MS).toISOString(),
		endUtc: new Date(nowMs + CALENDAR_SYNC_WINDOW_MS).toISOString(),
	};
	const calendars = await conn.listCalendars();
	const fetchedCalendars: string[] = [];
	const events: MirrorEvent[] = [];

	for (const calendar of calendars) {
		let objects: Awaited<ReturnType<CaldavConnection["fetchObjectsInWindow"]>>;
		try {
			objects = await conn.fetchObjectsInWindow(calendar.url, window);
		} catch {
			// This calendar failed to fetch; keep going with the others.
			continue;
		}
		fetchedCalendars.push(calendar.displayName);
		for (const object of objects) {
			for (const parsed of parseCalendarObject(object.data, window)) {
				events.push({
					uid: parsed.uid,
					etag: object.etag,
					href: object.href,
					calendarName: calendar.displayName,
					title: parsed.title,
					description: parsed.description,
					location: parsed.location,
					startUtc: parsed.startUtc,
					endUtc: parsed.endUtc,
					allDay: parsed.allDay,
					attendees: parsed.attendees,
					recurring: parsed.recurring,
				});
			}
		}
	}

	if (fetchedCalendars.length === 0) {
		throw new ServiceError("All CalDAV calendar fetches failed", null);
	}
	return { window, events, calendars: fetchedCalendars, trustEmpty: false };
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

/** An event with what tells whether it may be edited (lib/calendar-edit.ts). */
export type CalendarEventWithKind = CalendarEventRow & { recurring: boolean | null };

/**
 * Events on the days `firstIso` to `lastIso` (inclusive) in `tz`, soonest
 * first, by the same membership rule as the day view. Optionally only the
 * calendar named `calendarName`.
 */
export async function listEventsBetween(
	sb: SupabaseClient,
	firstIso: string,
	lastIso: string,
	tz: string,
	calendarName?: string,
): Promise<CalendarEventWithKind[]> {
	// A day wider on each side, for the reason listEventsOn gives.
	const { startUtc } = dayWindowUtc(shiftDay(firstIso, -1), tz);
	const { endUtc } = dayWindowUtc(shiftDay(lastIso, 1), tz);
	let query = sb
		.from("calendar_events")
		.select(`${EVENT_SELECT}, recurring`)
		.lt("start_at", endUtc)
		.gt("end_at", startUtc);
	if (calendarName !== undefined) query = query.ilike("calendar_name", escapeLike(calendarName));
	const data = unwrap(await query.order("start_at", { ascending: true }));
	const rows = (data ?? []) as unknown as CalendarEventWithKind[];
	return rows.filter((event) => eventFallsOnDays(event, firstIso, lastIso, tz));
}

export async function getEventWithKind(
	sb: SupabaseClient,
	id: string,
): Promise<CalendarEventWithKind | null> {
	const data = unwrap(
		await sb
			.from("calendar_events")
			.select(`${EVENT_SELECT}, recurring`)
			.eq("id", id)
			.maybeSingle(),
	);
	return (data as unknown as CalendarEventWithKind | null) ?? null;
}

export async function getEvent(sb: SupabaseClient, id: string): Promise<CalendarEventRow | null> {
	const data = unwrap(
		await sb.from("calendar_events").select(EVENT_SELECT).eq("id", id).maybeSingle(),
	);
	return (data as unknown as CalendarEventRow | null) ?? null;
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

/**
 * Creates an event on the CalDAV calendar named `ICLOUD_CALENDAR_NAME`
 * (the write calendar, docs/adr/0082), then mirrors it locally with
 * source='created_here'. The row keeps the object's href and etag, so the
 * event can be edited before the next sync.
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
	const written = await conn.createObject(
		target.url,
		`${uid}.ics`,
		buildEventObject({ uid, ...input }, nowIso),
	);

	const data = unwrap(
		await sb
			.from("calendar_events")
			.insert({
				caldav_uid: uid,
				caldav_href: written.href,
				caldav_etag: written.etag,
				calendar_name: target.displayName,
				title: input.title,
				description: input.description ?? null,
				location: input.location ?? null,
				start_at: input.startUtc,
				end_at: input.endUtc,
				all_day: false,
				attendees: [],
				recurring: false,
				source: "created_here",
				synced_at: nowIso,
			})
			.select(EVENT_SELECT)
			.single(),
	);
	return data as unknown as CalendarEventRow;
}

/** What `updateEvent` may change. `null` clears description or location. */
export type UpdateEventInput = EventPatch;

type EditableRow = CalendarEventRow & {
	caldav_href: string | null;
	caldav_etag: string | null;
	recurring: boolean | null;
};

/** The row behind an edit, or a NOT_FOUND / NOT_EDITABLE ServiceError. */
async function loadEditable(
	sb: SupabaseClient,
	id: string,
): Promise<EditableRow & { caldav_href: string; caldav_etag: string }> {
	const row = unwrap(
		await sb
			.from("calendar_events")
			.select(`${EVENT_SELECT}, caldav_href, caldav_etag, recurring`)
			.eq("id", id)
			.maybeSingle(),
	) as unknown as EditableRow | null;
	if (!row) throw new ServiceError("No event with that id.", "NOT_FOUND");
	const reason = whyNotEditable(row, env().ICLOUD_CALENDAR_NAME);
	if (reason) throw new ServiceError(reason, "NOT_EDITABLE");
	if (!row.caldav_href || !row.caldav_etag) {
		throw new ServiceError(
			"Dispatch has not synced this event yet. Sync, then try again.",
			"NOT_EDITABLE",
		);
	}
	return { ...row, caldav_href: row.caldav_href, caldav_etag: row.caldav_etag };
}

/** Compare etags as the server means them: `W/"x"`, `"x"` and `x` are one tag. */
function sameEtag(a: string, b: string): boolean {
	const bare = (tag: string) => tag.replace(/^W\//, "").replace(/^"|"$/g, "");
	return bare(a) === bare(b);
}

/**
 * The iCloud copy behind an edit, checked against the etag the last sync
 * saw. A copy iCloud no longer has takes its row with it, since a sync drops
 * only rows inside its window. Null then.
 */
async function liveCopy(
	sb: SupabaseClient,
	conn: CaldavConnection,
	row: EditableRow & { caldav_href: string; caldav_etag: string },
): Promise<{ etag: string; data: string } | null> {
	const current = await conn.fetchObject(row.caldav_href);
	if (!current) {
		unwrap(await sb.from("calendar_events").delete().eq("id", row.id));
		return null;
	}
	if (!sameEtag(current.etag, row.caldav_etag)) throw changedSinceSyncError();
	return current;
}

/**
 * Edit an event on iCloud first, then its row (docs/adr/0082). The iCloud
 * copy is read and patched, not rebuilt, so what Dispatch does not store —
 * alarms, attendees, time zones — survives. The write carries the etag the
 * last sync saw: a change made in Apple Calendar since then is a CONFLICT,
 * never overwritten.
 */
export async function updateEvent(
	sb: SupabaseClient,
	conn: CaldavConnection,
	id: string,
	patch: UpdateEventInput,
): Promise<CalendarEventRow> {
	const row = await loadEditable(sb, id);
	const current = await liveCopy(sb, conn, row);
	if (!current) {
		throw new ServiceError("This event is no longer in iCloud. Dispatch removed it.", "NOT_FOUND");
	}

	let patched: ReturnType<typeof patchEventObject>;
	try {
		patched = patchEventObject(current.data, patch, nowUtc());
	} catch (err) {
		if (err instanceof EventPatchError) throw new ServiceError(err.message, "NOT_EDITABLE");
		throw err;
	}
	const written = await conn.updateObject(row.caldav_href, patched.icalText, current.etag);

	const data = unwrap(
		await sb
			.from("calendar_events")
			.update({
				title: patched.title,
				description: patched.description,
				location: patched.location,
				start_at: patched.startUtc,
				end_at: patched.endUtc,
				// No new etag from iCloud: keep the old one. The next edit then
				// gets a CONFLICT, and a sync learns the real etag.
				caldav_etag: written.etag ?? row.caldav_etag,
			})
			.eq("id", id)
			.select(EVENT_SELECT)
			.single(),
	);
	return data as unknown as CalendarEventRow;
}

/**
 * Delete an event on iCloud first, then its row, under the same rules and
 * the same etag check as `updateEvent`. The live copy is read first, so a
 * series is refused even before a sync has marked the row. Answers with the
 * row as it was, so a caller can offer to create it again. Note links to it
 * go with the row.
 */
export async function deleteEvent(
	sb: SupabaseClient,
	conn: CaldavConnection,
	id: string,
): Promise<CalendarEventRow> {
	const row = await loadEditable(sb, id);
	const current = await liveCopy(sb, conn, row);
	if (current) {
		try {
			assertSingleEvent(current.data);
		} catch (err) {
			if (err instanceof EventPatchError) throw new ServiceError(err.message, "NOT_EDITABLE");
			throw err;
		}
		await conn.deleteObject(row.caldav_href, current.etag);
		unwrap(await sb.from("calendar_events").delete().eq("id", id));
	}
	const { caldav_href: _href, caldav_etag: _etag, recurring: _recurring, ...event } = row;
	return event;
}
