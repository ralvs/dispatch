import { describe, expect, it } from "vitest";
import {
	buildEventObject,
	EventPatchError,
	escapeIcalText,
	parseCalendarObject,
	patchEventObject,
} from "./ical";

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
				recurring: false,
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
		expect(events[0].recurring).toBe(true);
	});

	it("marks an override of a series as recurring", () => {
		const ics = vcalendar(
			[
				"BEGIN:VEVENT",
				"UID:override-1@test",
				"DTSTAMP:20260601T000000Z",
				"RECURRENCE-ID:20260713T090000Z",
				"DTSTART:20260713T100000Z",
				"DTEND:20260713T103000Z",
				"SUMMARY:Moved standup",
				"END:VEVENT",
			].join("\n"),
		);

		expect(parseCalendarObject(ics, WINDOW)[0]?.recurring).toBe(true);
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

const NOW = "2026-07-10T12:00:00.000Z";

describe("escapeIcalText", () => {
	it("escapes backslash, semicolon, comma and newlines", () => {
		expect(escapeIcalText("a\\b; c, d\ne\r\nf")).toBe("a\\\\b\\; c\\, d\\ne\\nf");
	});
});

describe("buildEventObject", () => {
	it("writes a description with a newline as one property that parses back", () => {
		const ics = buildEventObject(
			{
				uid: "u-1",
				title: "Lunch; with Ana, maybe",
				startUtc: "2026-07-10T15:00:00.000Z",
				endUtc: "2026-07-10T16:00:00.000Z",
				description: "Bring:\n- the book",
				location: "Rua A, 10",
			},
			NOW,
		);

		expect(ics).toContain("DESCRIPTION:Bring:\\n- the book\r\n");
		expect(parseCalendarObject(ics, WINDOW)).toEqual([
			{
				uid: "u-1",
				title: "Lunch; with Ana, maybe",
				description: "Bring:\n- the book",
				location: "Rua A, 10",
				startUtc: "2026-07-10T15:00:00.000Z",
				endUtc: "2026-07-10T16:00:00.000Z",
				allDay: false,
				attendees: [],
				recurring: false,
			},
		]);
	});
});

describe("patchEventObject", () => {
	const ICS = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"BEGIN:VEVENT",
		"UID:p-1",
		"DTSTAMP:20260701T000000Z",
		"DTSTART:20260710T140000Z",
		"DTEND:20260710T150000Z",
		"SUMMARY:Dentist",
		"LOCATION:Clinic",
		"SEQUENCE:2",
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		"TRIGGER:-PT15M",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	].join("\r\n");

	it("changes only the patched fields and keeps the alarm", () => {
		const patched = patchEventObject(ICS, { title: "Dentist, again", location: null }, NOW);
		const out = patched.icalText;

		expect(parseCalendarObject(out, WINDOW)[0]).toMatchObject({
			title: "Dentist, again",
			location: null,
			startUtc: "2026-07-10T14:00:00.000Z",
			endUtc: "2026-07-10T15:00:00.000Z",
		});
		expect(out).toContain("BEGIN:VALARM");
		expect(out).toContain("SEQUENCE:3");
		expect(out).toContain("DTSTAMP:20260710T120000Z");
		expect(patched).toMatchObject({ title: "Dentist, again", location: null, description: null });
	});

	it("keeps the length when only the start moves", () => {
		const patched = patchEventObject(ICS, { startUtc: "2026-07-11T09:00:00.000Z" }, NOW);

		const moved = { startUtc: "2026-07-11T09:00:00.000Z", endUtc: "2026-07-11T10:00:00.000Z" };
		expect(parseCalendarObject(patched.icalText, WINDOW)[0]).toMatchObject(moved);
		expect(patched).toMatchObject(moved);
	});

	it("refuses an end at or before the start", () => {
		expect(() => patchEventObject(ICS, { endUtc: "2026-07-10T13:00:00.000Z" }, NOW)).toThrow(
			EventPatchError,
		);
	});

	it("refuses a series", () => {
		const series = ICS.replace("SUMMARY:Dentist", "SUMMARY:Dentist\r\nRRULE:FREQ=WEEKLY");
		expect(() => patchEventObject(series, { title: "x" }, NOW)).toThrow(EventPatchError);
	});

	it("refuses to move an all-day event but lets its title change", () => {
		const allDay = ICS.replace("DTSTART:20260710T140000Z", "DTSTART;VALUE=DATE:20260710").replace(
			"DTEND:20260710T150000Z",
			"DTEND;VALUE=DATE:20260711",
		);

		expect(() => patchEventObject(allDay, { startUtc: "2026-07-11T09:00:00.000Z" }, NOW)).toThrow(
			EventPatchError,
		);
		expect(
			parseCalendarObject(patchEventObject(allDay, { title: "Off" }, NOW).icalText, WINDOW)[0],
		).toMatchObject({ title: "Off", allDay: true });
	});
});
