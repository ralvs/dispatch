import ICAL from "ical.js";

// ─────────────────────────────────────────────────────────────────────────
// Pure iCal parsing and writing (docs/adr/0006). No network here — this
// module turns a raw VCALENDAR text blob (one CalDAV object) into the events
// that fall inside a window, and builds or patches the objects Dispatch
// writes, so it can be fully unit-tested with inline fixtures.
//
// RRULE handling: calendar_events.caldav_uid is unique, so a recurring VEVENT
// can only ever produce ONE row. We return the first occurrence that
// intersects the window; the frequent re-sync (±21 days, run often) keeps
// that row pointing at whichever occurrence is currently "in view".
// ─────────────────────────────────────────────────────────────────────────

export type ParsedEvent = {
	uid: string;
	title: string;
	description: string | null;
	location: string | null;
	startUtc: string;
	endUtc: string;
	allDay: boolean;
	attendees: string[];
	/** True when the object holds a series (RRULE/RDATE) or one of its overrides. */
	recurring: boolean;
};

export type Window = { startUtc: string; endUtc: string };

// Hard cap on RRULE expansion so a pathological rule (or a bug in our own
// loop) can't spin forever looking for an occurrence that never intersects
// the window.
const MAX_RECUR_ITERATIONS = 1000;

/** Convert an ICAL.Time to a UTC ISO instant, independent of server tz. */
function timeToUtcIso(time: ICAL.Time): string {
	if (time.isDate) {
		// All-day / date-only value: anchor at UTC midnight of that calendar
		// date rather than going through JS Date's local-timezone Date()
		// constructor (which toJSDate uses for floating/date-only values).
		return new Date(Date.UTC(time.year, time.month - 1, time.day)).toISOString();
	}
	return new Date(time.toUnixTime() * 1000).toISOString();
}

/**
 * Register any embedded VTIMEZONE components so DTSTART/DTEND properties
 * carrying a TZID resolve to the correct offset instead of falling back to
 * floating (server-local) time. iCloud always embeds VTIMEZONE for
 * non-UTC events.
 */
function registerTimezones(root: ICAL.Component): void {
	for (const vtimezone of root.getAllSubcomponents("vtimezone")) {
		try {
			ICAL.TimezoneService.register(vtimezone);
		} catch {
			// Malformed VTIMEZONE — ignore; TZID lookups fall back to floating time.
		}
	}
}

function extractAttendees(event: ICAL.Event): string[] {
	return event.attendees
		.map((prop) => {
			const value = prop.getFirstValue();
			return typeof value === "string" ? value.replace(/^mailto:/i, "") : null;
		})
		.filter((v): v is string => Boolean(v));
}

function intersects(
	startMs: number,
	endMs: number,
	windowStartMs: number,
	windowEndMs: number,
): boolean {
	return startMs < windowEndMs && endMs > windowStartMs;
}

/**
 * A series is one row here (see the RRULE note above), so the object as a
 * whole counts: an override VEVENT (RECURRENCE-ID) belongs to a series too.
 */
function holdsSeries(root: ICAL.Component): boolean {
	return root
		.getAllSubcomponents("vevent")
		.some(
			(vevent) =>
				vevent.hasProperty("rrule") ||
				vevent.hasProperty("rdate") ||
				vevent.hasProperty("recurrence-id"),
		);
}

/** Parse a single VCALENDAR blob into the VEVENTs that intersect `window`. */
export function parseCalendarObject(icalText: string, window: Window): ParsedEvent[] {
	try {
		const windowStartMs = new Date(window.startUtc).getTime();
		const windowEndMs = new Date(window.endUtc).getTime();
		if (Number.isNaN(windowStartMs) || Number.isNaN(windowEndMs)) return [];

		const jcal = ICAL.parse(icalText);
		const root = new ICAL.Component(jcal);
		registerTimezones(root);
		const recurring = holdsSeries(root);

		const results: ParsedEvent[] = [];

		for (const vevent of root.getAllSubcomponents("vevent")) {
			const event = new ICAL.Event(vevent);
			if (!event.uid || !event.startDate) continue;

			const allDay = event.startDate.isDate;
			const attendees = extractAttendees(event);
			const title = event.summary ?? "";
			const description = event.description || null;
			const location = event.location || null;

			if (event.isRecurring()) {
				const iterator = event.iterator();
				let occurrence: { startUtc: string; endUtc: string } | null = null;

				for (let i = 0; i < MAX_RECUR_ITERATIONS; i++) {
					const next = iterator.next();
					if (!next) break;

					const details = event.getOccurrenceDetails(next);
					const startUtc = timeToUtcIso(details.startDate);
					const endUtc = timeToUtcIso(details.endDate);
					const startMs = new Date(startUtc).getTime();
					const endMs = new Date(endUtc).getTime();

					if (intersects(startMs, endMs, windowStartMs, windowEndMs)) {
						occurrence = { startUtc, endUtc };
						break;
					}
					// Occurrences come out in ascending order — once we're past
					// the window there's no point continuing.
					if (startMs > windowEndMs) break;
				}

				if (!occurrence) continue;
				results.push({
					uid: event.uid,
					title,
					description,
					location,
					startUtc: occurrence.startUtc,
					endUtc: occurrence.endUtc,
					allDay,
					attendees,
					recurring,
				});
				continue;
			}

			const startUtc = timeToUtcIso(event.startDate);
			const endUtc = timeToUtcIso(event.endDate ?? event.startDate);
			const startMs = new Date(startUtc).getTime();
			const endMs = new Date(endUtc).getTime();
			if (!intersects(startMs, endMs, windowStartMs, windowEndMs)) continue;

			results.push({
				uid: event.uid,
				title,
				description,
				location,
				startUtc,
				endUtc,
				allDay,
				attendees,
				recurring,
			});
		}

		return results;
	} catch {
		// Malformed input must never throw into the sync path (iron rule #4's
		// spirit applies here too — degrade, don't crash).
		return [];
	}
}

// ─── Writing ──────────────────────────────────────────────────────────────

export type NewEvent = {
	uid: string;
	title: string;
	startUtc: string;
	endUtc: string;
	description?: string;
	location?: string;
};

/** `YYYYMMDDTHHmmssZ` — iCal's basic UTC datetime form, from an ISO instant. */
function toIcalUtc(isoInstant: string): string {
	return new Date(isoInstant)
		.toISOString()
		.replace(/\.\d{3}Z$/, "Z")
		.replace(/[-:]/g, "");
}

/**
 * Escape a TEXT value (RFC 5545 §3.3.11): backslash, semicolon, comma and
 * newline. An unescaped newline ends the property and breaks the object.
 */
export function escapeIcalText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r\n|\r|\n/g, "\\n");
}

/** One VCALENDAR holding one timed VEVENT, as Dispatch creates it. */
export function buildEventObject(event: NewEvent, nowIso: string): string {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Dispatch//EN",
		"BEGIN:VEVENT",
		`UID:${event.uid}`,
		`DTSTAMP:${toIcalUtc(nowIso)}`,
		`DTSTART:${toIcalUtc(event.startUtc)}`,
		`DTEND:${toIcalUtc(event.endUtc)}`,
		`SUMMARY:${escapeIcalText(event.title)}`,
	];
	if (event.description) lines.push(`DESCRIPTION:${escapeIcalText(event.description)}`);
	if (event.location) lines.push(`LOCATION:${escapeIcalText(event.location)}`);
	lines.push("END:VEVENT", "END:VCALENDAR");
	return lines.join("\r\n");
}

/** The fields an edit may change. `null` clears description or location. */
export type EventPatch = {
	title?: string;
	startUtc?: string;
	endUtc?: string;
	description?: string | null;
	location?: string | null;
};

/** Why an object cannot be patched; the service turns it into a ServiceError. */
export class EventPatchError extends Error {
	override name = "EventPatchError";
}

/** The patched object, and the fields the local row mirrors from it. */
export type PatchedEvent = {
	icalText: string;
	title: string;
	description: string | null;
	location: string | null;
	startUtc: string;
	endUtc: string;
};

/**
 * Apply `patch` to the one VEVENT in `icalText` and return the new object.
 * Everything Dispatch does not model — alarms, attendees, URL, the time
 * zone of an untouched end — stays as the server had it. A moved start with
 * no new end keeps the event's length. Throws EventPatchError for a series,
 * an all-day event whose times change, or an end at or before the start.
 */
/**
 * The one VEVENT of an object Dispatch may change, or an EventPatchError:
 * unreadable, a series, or not exactly one event.
 */
function singleEvent(icalText: string): { root: ICAL.Component; vevent: ICAL.Component } {
	let root: ICAL.Component;
	try {
		root = new ICAL.Component(ICAL.parse(icalText));
	} catch {
		throw new EventPatchError("The iCloud copy of this event could not be read.");
	}
	registerTimezones(root);
	if (holdsSeries(root)) {
		throw new EventPatchError("This event repeats. Dispatch does not edit a series.");
	}
	const vevents = root.getAllSubcomponents("vevent");
	if (vevents.length !== 1) {
		throw new EventPatchError("The iCloud copy of this event holds no single event.");
	}
	return { root, vevent: vevents[0] as ICAL.Component };
}

/** Throws an EventPatchError unless the object is one single event. */
export function assertSingleEvent(icalText: string): void {
	singleEvent(icalText);
}

export function patchEventObject(
	icalText: string,
	patch: EventPatch,
	nowIso: string,
): PatchedEvent {
	const { root, vevent } = singleEvent(icalText);
	const event = new ICAL.Event(vevent);

	if (patch.title !== undefined) event.summary = patch.title;
	if (patch.description !== undefined) setOptionalText(vevent, "description", patch.description);
	if (patch.location !== undefined) setOptionalText(vevent, "location", patch.location);

	if (patch.startUtc !== undefined || patch.endUtc !== undefined) {
		if (event.startDate.isDate) {
			throw new EventPatchError("This is an all-day event; Dispatch does not move one.");
		}
		const oldStartMs = event.startDate.toUnixTime() * 1000;
		const oldEndMs = (event.endDate ?? event.startDate).toUnixTime() * 1000;
		const startMs = patch.startUtc !== undefined ? Date.parse(patch.startUtc) : oldStartMs;
		const endMs =
			patch.endUtc !== undefined ? Date.parse(patch.endUtc) : startMs + (oldEndMs - oldStartMs);
		if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
			throw new EventPatchError("The event must end after it starts.");
		}
		if (patch.startUtc !== undefined) event.startDate = utcTime(startMs);
		if (patch.endUtc !== undefined || patch.startUtc !== undefined) {
			// DURATION and DTEND are exclusive; write DTEND only.
			vevent.removeAllProperties("duration");
			event.endDate = utcTime(endMs);
		}
	}

	vevent.updatePropertyWithValue("dtstamp", utcTime(Date.parse(nowIso)));
	const sequence = Number(vevent.getFirstPropertyValue("sequence") ?? 0);
	vevent.updatePropertyWithValue("sequence", Number.isFinite(sequence) ? sequence + 1 : 1);
	return {
		icalText: root.toString(),
		title: event.summary ?? "",
		description: event.description || null,
		location: event.location || null,
		startUtc: timeToUtcIso(event.startDate),
		endUtc: timeToUtcIso(event.endDate ?? event.startDate),
	};
}

function utcTime(ms: number): ICAL.Time {
	return ICAL.Time.fromJSDate(new Date(ms), true);
}

function setOptionalText(vevent: ICAL.Component, name: string, value: string | null): void {
	if (value === null || value === "") vevent.removeAllProperties(name);
	else vevent.updatePropertyWithValue(name, value);
}
