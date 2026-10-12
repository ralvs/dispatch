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
import type { SyncState } from "@/lib/calendar-health";
import { CALENDAR_SYNC_WINDOW_MS } from "@/lib/constants";
import { dayWindowUtc, nowUtc, shiftDay } from "@/lib/dates";
import { eventFallsOnDay, eventFallsOnDays } from "@/lib/day-schedule";
import { env } from "@/lib/env";
import { escapeLike } from "@/lib/like";
import { type CalendarEventRow, EVENT_SELECT } from "@/lib/schemas/calendar";
import { ServiceError, unwrap } from "@/lib/services/errors";
import { inListLiteral } from "@/lib/services/in-list";

// ─────────────────────────────────────────────────────────────────────────
// iCloud CalDAV sync (docs/adr/0006). Pulls VEVENTs ±21 days from every
// calendar on the account; app-created events push only to the calendar
// named `ICLOUD_CALENDAR_NAME`, the write calendar (docs/adr/0082), and only
// single events there may be edited or deleted. Cancellation detection is a
// windowed set-difference on `caldav_uid` — CalDAV has no tombstones, so a
// row that falls inside the window but wasn't seen on this sync is gone.
// Identity is unique on (source, caldav_uid) after docs/adr/0018; an event
// Dispatch created keeps its one `created_here` row, matched on UID.
// ─────────────────────────────────────────────────────────────────────────

export type { CalendarEventRow };

/** The sources the CalDAV sync owns: pulled events, and events created here. */
const ICLOUD_SOURCES = ["caldav", "created_here"];

type KnownRow = {
	id: string;
	source: "caldav" | "created_here";
	caldav_uid: string | null;
	caldav_etag: string | null;
	start_at: string;
	recurring: boolean | null;
};

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

	// Known iCloud rows, so unchanged events (same etag AND same resolved start
	// — a recurring event's start advances as the window slides, etag doesn't)
	// skip their upsert. Keeps `pulled` meaning "new or changed", so a quiet
	// sync writes no rows, no ledger entry, and sends no push. A row whose
	// `recurring` is still null is rewritten once, to learn it.
	const existingRows = (unwrap(
		await sb
			.from("calendar_events")
			.select("id, source, caldav_uid, caldav_etag, start_at, recurring")
			.in("source", ICLOUD_SOURCES),
	) ?? []) as KnownRow[];
	// An event Dispatch created comes back on the next sync under the same UID.
	// Its `created_here` row is the one row for it, so it wins the UID: the
	// sync updates it in place instead of adding a `caldav` twin.
	const knownByUid = new Map<string, KnownRow>();
	for (const row of existingRows) {
		if (row.caldav_uid === null) continue;
		const held = knownByUid.get(row.caldav_uid);
		if (!held || row.source === "created_here") knownByUid.set(row.caldav_uid, row);
	}
	const fetchedCalendars: string[] = [];

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
		fetchedCalendars.push(calendar.displayName);

		for (const object of objects) {
			const parsedEvents = parseCalendarObject(object.data, window);
			for (const parsed of parsedEvents) {
				seenUids.add(parsed.uid);
				const known = knownByUid.get(parsed.uid);
				if (
					known &&
					known.caldav_etag === object.etag &&
					known.recurring === parsed.recurring &&
					Date.parse(known.start_at) === Date.parse(parsed.startUtc)
				) {
					continue;
				}
				const fields = {
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
					recurring: parsed.recurring,
					synced_at: syncedAt,
				};
				if (known?.source === "created_here") {
					unwrap(await sb.from("calendar_events").update(fields).eq("id", known.id));
				} else {
					unwrap(
						await sb
							.from("calendar_events")
							.upsert({ ...fields, source: "caldav" }, { onConflict: "source,caldav_uid" }),
					);
				}
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
	// rather than "delete everything in the window". Only calendars that
	// answered are compared: a calendar whose fetch failed saw nothing. A row
	// written after this sync began (an event created meanwhile) is not
	// compared either — the fetch may have run before it existed.
	if (seenUids.size > 0) {
		const deleted = unwrap(
			await sb
				.from("calendar_events")
				.delete()
				.in("source", ICLOUD_SOURCES)
				.in("calendar_name", fetchedCalendars)
				.lt("synced_at", syncedAt)
				.gte("start_at", windowStartUtc)
				.lt("start_at", windowEndUtc)
				.not("caldav_uid", "in", inListLiteral(seenUids))
				.select("id"),
		);
		removed = ((deleted as unknown[] | null) ?? []).length;
	}

	await dropCaldavTwins(sb);

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

/**
 * A `caldav` row whose UID a `created_here` row holds is a twin: the same
 * event, written by a sync that read the known rows before the create
 * committed. The `created_here` row is the one row (docs/adr/0082).
 */
async function dropCaldavTwins(sb: SupabaseClient): Promise<void> {
	const created = (unwrap(
		await sb
			.from("calendar_events")
			.select("caldav_uid")
			.eq("source", "created_here")
			.not("caldav_uid", "is", null),
	) ?? []) as { caldav_uid: string }[];
	if (created.length === 0) return;
	unwrap(
		await sb
			.from("calendar_events")
			.delete()
			.eq("source", "caldav")
			.in(
				"caldav_uid",
				created.map((r) => r.caldav_uid),
			),
	);
}

/**
 * Both feeds' sync-state singletons, for Today's calendar health line (#96).
 * Both tables are RLS-on with no policy, so `sb` must be the service client;
 * call it only after the owner check (iron rule #2). A missing row is null.
 */
export async function readCalendarSyncStates(
	sb: SupabaseClient,
): Promise<{ work: SyncState | null; icloud: SyncState | null }> {
	const [work, icloud] = await Promise.all([
		sb.from("google_sync_state").select("last_synced_at, last_result").maybeSingle(),
		sb.from("caldav_sync_state").select("last_synced_at, last_result").maybeSingle(),
	]);
	return {
		work: (unwrap(work) ?? null) as SyncState | null,
		icloud: (unwrap(icloud) ?? null) as SyncState | null,
	};
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
