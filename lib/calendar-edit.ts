import type { CalendarEventSource } from "@/lib/schemas/calendar";

// Which events Dispatch may edit or delete on iCloud (docs/adr/0082). Only a
// single event on the write calendar: work events are pull-only (ADR-0018),
// the other iCloud calendars are shared, and one row stands for a whole
// series (lib/caldav/ical.ts), so an edit there would change every occurrence.

export type EditableFields = {
	source: CalendarEventSource;
	calendar_name: string | null;
	/**
	 * Null until a sync has read the event's iCloud copy. Not a refusal: the
	 * edit reads the live copy and refuses a series from that.
	 */
	recurring: boolean | null;
};

/**
 * Null when the event may be edited; otherwise the reason, written for the
 * owner. `writeCalendar` is `ICLOUD_CALENDAR_NAME`, undefined when unset.
 */
export function whyNotEditable(
	event: EditableFields,
	writeCalendar: string | undefined,
): string | null {
	if (event.source === "google") {
		return "This is a work event. Dispatch only reads the work calendar.";
	}
	if (!writeCalendar) return "The iCloud calendar is not set up.";
	if (event.calendar_name !== writeCalendar) {
		return `This event is on the "${event.calendar_name ?? "unknown"}" calendar. Dispatch edits only "${writeCalendar}".`;
	}
	if (event.recurring === true) {
		return "This event repeats. Dispatch does not edit a series.";
	}
	return null;
}
