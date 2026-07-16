import { describe, expect, it } from "vitest";
import { parseCalendarObject } from "./ical";

const WINDOW = { startUtc: "2026-07-09T00:00:00.000Z", endUtc: "2026-07-16T00:00:00.000Z" };

function vcalendar(vevent: string): string {
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Dispatch//Test//EN",
		vevent,
		"END:VCALENDAR",
	].join("\n");
}

describe("parseCalendarObject", () => {
	it("parses a plain timed event inside the window", () => {
		const ics = vcalendar(
			[
				"BEGIN:VEVENT",
				"UID:event-1@test",
				"DTSTAMP:20260701T000000Z",
				"DTSTART:20260710T140000Z",
				"DTEND:20260710T150000Z",
				"SUMMARY:Team sync",
				"DESCRIPTION:Weekly check-in",
				"LOCATION:Room 1",
				"ATTENDEE:mailto:a@example.com",
				"ATTENDEE:mailto:b@example.com",
				"END:VEVENT",
			].join("\n"),
		);

		const events = parseCalendarObject(ics, WINDOW);

		expect(events).toEqual([
			{
				uid: "event-1@test",
				title: "Team sync",
				description: "Weekly check-in",
				location: "Room 1",
				startUtc: "2026-07-10T14:00:00.000Z",
				endUtc: "2026-07-10T15:00:00.000Z",
				allDay: false,
				attendees: ["a@example.com", "b@example.com"],
			},
		]);
	});

	it("parses an all-day event, defaulting a missing DTEND to one day", () => {
		const ics = vcalendar(
			[
				"BEGIN:VEVENT",
				"UID:allday-1@test",
				"DTSTAMP:20260701T000000Z",
				"DTSTART;VALUE=DATE:20260712",
				"SUMMARY:Company holiday",
				"END:VEVENT",
			].join("\n"),
		);

		const events = parseCalendarObject(ics, WINDOW);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			uid: "allday-1@test",
			title: "Company holiday",
			allDay: true,
			startUtc: "2026-07-12T00:00:00.000Z",
			endUtc: "2026-07-13T00:00:00.000Z",
		});
	});

	it("expands a weekly RRULE and returns only the occurrence inside the window", () => {
		const ics = vcalendar(
			[
				"BEGIN:VEVENT",
				"UID:recurring-1@test",
				"DTSTAMP:20260601T000000Z",
				"DTSTART:20260601T090000Z",
				"DTEND:20260601T093000Z",
				"SUMMARY:Weekly standup",
				"RRULE:FREQ=WEEKLY",
				"END:VEVENT",
			].join("\n"),
		);

		const events = parseCalendarObject(ics, WINDOW);

		expect(events).toHaveLength(1);
		expect(events[0].uid).toBe("recurring-1@test");
		// Window is 2026-07-09..16; the weekly-from-06-01 occurrence landing
		// there is 2026-07-13.
		expect(events[0].startUtc).toBe("2026-07-13T09:00:00.000Z");
		expect(events[0].endUtc).toBe("2026-07-13T09:30:00.000Z");
	});

	it("excludes an event entirely outside the window", () => {
		const ics = vcalendar(
			[
				"BEGIN:VEVENT",
				"UID:outside-1@test",
				"DTSTAMP:20260101T000000Z",
				"DTSTART:20260101T100000Z",
				"DTEND:20260101T110000Z",
				"SUMMARY:New year kickoff",
				"END:VEVENT",
			].join("\n"),
		);

		expect(parseCalendarObject(ics, WINDOW)).toEqual([]);
	});

	it("never throws on malformed input", () => {
		expect(() => parseCalendarObject("this is not an ical document", WINDOW)).not.toThrow();
		expect(parseCalendarObject("this is not an ical document", WINDOW)).toEqual([]);
		expect(parseCalendarObject("", WINDOW)).toEqual([]);
	});
});
