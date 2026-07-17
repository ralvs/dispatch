import { describe, expect, it } from "vitest";
import {
	dateOfInstant,
	dayWindowUtc,
	formatDateline,
	instantFromLocal,
	isoWeek,
	shiftDay,
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

	it("renders the masthead dateline in uppercase mono style", () => {
		expect(formatDateline("2026-07-17")).toBe("FRI · JUL 17 · WEEK 29");
	});

	it("throws on an invalid date", () => {
		expect(() => isoWeek("not-a-date")).toThrow();
		expect(() => formatDateline("not-a-date")).toThrow();
	});
});
