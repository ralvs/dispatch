import ICAL from "ical.js";

// ─────────────────────────────────────────────────────────────────────────
// Pure iCal parsing (docs/adr/0006). No network here — this module turns a
// raw VCALENDAR text blob (one CalDAV object) into the events that fall
// inside a window, so it can be fully unit-tested with inline fixtures.
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

/** Parse a single VCALENDAR blob into the VEVENTs that intersect `window`. */
export function parseCalendarObject(icalText: string, window: Window): ParsedEvent[] {
	try {
		const windowStartMs = new Date(window.startUtc).getTime();
		const windowEndMs = new Date(window.endUtc).getTime();
		if (Number.isNaN(windowStartMs) || Number.isNaN(windowEndMs)) return [];

		const jcal = ICAL.parse(icalText);
		const root = new ICAL.Component(jcal);
		registerTimezones(root);

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
			});
		}

		return results;
	} catch {
		// Malformed input must never throw into the sync path (iron rule #4's
		// spirit applies here too — degrade, don't crash).
		return [];
	}
}
