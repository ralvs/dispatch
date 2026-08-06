import { describe, expect, it } from "vitest";
import {
	dateOfInstant,
	dayWindowUtc,
	formatDateline,
	formatDayNavLabel,
	instantFromLocal,
	isoWeek,
	isValidTimezone,
	isWallClockTime,
	parseDateIso,
	shiftDay,
	shiftMinutes,
	startOfWeek,
	todayInTz,
} from "./dates";

const SP = "America/Sao_Paulo"; // UTC-3, no DST since 2019

describe("todayInTz", () => {
	it("rolls the calendar day at the app-timezone midnight, not UTC midnight", () => {
		// 2026-07-14 01:30 UTC is still 2026-07-13 22:30 in São Paulo.
		const nowMs = Date.parse("2026-07-14T01:30:00Z");
		expect(todayInTz(SP, nowMs)).toBe("2026-07-13");
		expect(todayInTz("utc", nowMs)).toBe("2026-07-14");
	});
});

describe("dateOfInstant", () => {
	it("maps a late-night UTC instant to the previous local day", () => {
		expect(dateOfInstant("2026-07-14T02:59:00Z", SP)).toBe("2026-07-13");
		expect(dateOfInstant("2026-07-14T03:00:00Z", SP)).toBe("2026-07-14");
	});
});

describe("dayWindowUtc", () => {
	it("covers exactly the local day as a UTC range", () => {
		const { startUtc, endUtc } = dayWindowUtc("2026-07-14", SP);
		expect(startUtc).toBe("2026-07-14T03:00:00.000Z");
		expect(endUtc).toBe("2026-07-15T03:00:00.000Z");
	});
});

describe("shiftDay / startOfWeek", () => {
	it("shifts across month boundaries", () => {
		expect(shiftDay("2026-01-31", 1)).toBe("2026-02-01");
		expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
	});

	it("anchors weeks on Monday", () => {
		// 2026-07-14 is a Tuesday.
		expect(startOfWeek("2026-07-14")).toBe("2026-07-13");
		expect(startOfWeek("2026-07-13")).toBe("2026-07-13");
	});
});

describe("instantFromLocal", () => {
	it("converts local wall-clock to the correct UTC instant", () => {
		expect(instantFromLocal("2026-07-14", "15:00", SP)).toBe("2026-07-14T18:00:00.000Z");
	});
});

describe("isoWeek / formatDateline", () => {
	it("computes ISO week numbers, including year-boundary weeks", () => {
		// 2026-07-17 is a Friday in ISO week 29.
		expect(isoWeek("2026-07-17")).toBe(29);
		// 2026-01-01 is a Thursday — ISO week 1.
		expect(isoWeek("2026-01-01")).toBe(1);
		// 2027-01-01 is a Friday — still ISO week 53 of 2026.
		expect(isoWeek("2027-01-01")).toBe(53);
	});

	it("renders the masthead dateline in sentence case", () => {
		expect(formatDateline("2026-07-17")).toBe("Fri · Jul 17 · Week 29");
	});

	it("throws on an invalid date", () => {
		expect(() => isoWeek("not-a-date")).toThrow();
		expect(() => formatDateline("not-a-date")).toThrow();
	});
});

describe("shiftMinutes", () => {
	it("shifts forward", () => {
		expect(shiftMinutes("2026-07-14T12:00:00.000Z", 30)).toBe("2026-07-14T12:30:00.000Z");
	});

	it("shifts backward", () => {
		expect(shiftMinutes("2026-07-14T12:00:00.000Z", -30)).toBe("2026-07-14T11:30:00.000Z");
	});

	it("crosses a UTC day boundary", () => {
		expect(shiftMinutes("2026-07-14T00:10:00.000Z", -20)).toBe("2026-07-13T23:50:00.000Z");
	});
});

describe("isWallClockTime", () => {
	it("accepts HH:MM and HH:MM:SS", () => {
		expect(isWallClockTime("09:00")).toBe(true);
		expect(isWallClockTime("09:00:00")).toBe(true);
	});

	// A Postgres `time` written from an expression rather than a literal comes
	// back with a fraction. Rejecting it is silent — the caller falls back to a
	// default anchor and the reminder fires at the wrong hour.
	it("accepts the fractional seconds a Postgres time column can return", () => {
		expect(isWallClockTime("17:20:07.87081")).toBe(true);
	});

	it("rejects malformed or missing values", () => {
		expect(isWallClockTime("9:00")).toBe(false);
		expect(isWallClockTime("sometime")).toBe(false);
		expect(isWallClockTime("")).toBe(false);
		expect(isWallClockTime(null)).toBe(false);
	});
});

describe("isValidTimezone", () => {
	it("accepts IANA zone names", () => {
		expect(isValidTimezone(SP)).toBe(true);
		expect(isValidTimezone("UTC")).toBe(true);
		expect(isValidTimezone("Europe/Lisbon")).toBe(true);
	});

	it("rejects typos, abbreviations, and empty input", () => {
		expect(isValidTimezone("America/Sao_Paolo")).toBe(false);
		expect(isValidTimezone("BRT")).toBe(false);
		expect(isValidTimezone("")).toBe(false);
	});
});

describe("parseDateIso", () => {
	it("accepts a real calendar date", () => {
		expect(parseDateIso("2026-07-29")).toBe("2026-07-29");
	});

	it("rejects a day that does not exist even though it parses", () => {
		// Luxon reads 2026-02-30 as valid-ish input; the round-trip is the gate.
		expect(parseDateIso("2026-02-30")).toBeNull();
		expect(parseDateIso("2026-13-01")).toBeNull();
	});

	it("rejects anything that is not a bare YYYY-MM-DD string", () => {
		expect(parseDateIso("2026-7-9")).toBeNull();
		expect(parseDateIso("2026-07-29T10:00:00Z")).toBeNull();
		expect(parseDateIso("")).toBeNull();
		expect(parseDateIso(undefined)).toBeNull();
		expect(parseDateIso(20260729)).toBeNull();
	});
});

describe("formatDayNavLabel", () => {
	const today = "2026-07-29";

	it("names the three days around today in words", () => {
		expect(formatDayNavLabel(today, today)).toBe("Today");
		expect(formatDayNavLabel("2026-07-28", today)).toBe("Yesterday");
		expect(formatDayNavLabel("2026-07-30", today)).toBe("Tomorrow");
	});

	it("falls back to a dateline further out", () => {
		expect(formatDayNavLabel("2026-08-03", today)).toBe("Mon · Aug 3");
		expect(formatDayNavLabel("2026-07-26", today)).toBe("Sun · Jul 26");
	});

	it("crosses a month boundary without drifting", () => {
		expect(formatDayNavLabel("2026-08-01", "2026-07-31")).toBe("Tomorrow");
		expect(formatDayNavLabel("2026-07-31", "2026-08-01")).toBe("Yesterday");
	});
});
