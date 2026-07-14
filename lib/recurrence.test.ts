import { describe, expect, it } from "vitest";
import { isCurrentlyDoneRecurring, nextDueDate, periodStart } from "./recurrence";

describe("nextDueDate", () => {
	it("steps each pattern forward from the due date", () => {
		const base = { currentDue: "2026-07-20", todayIso: "2026-07-14" } as const;
		expect(nextDueDate({ ...base, rule: "daily" })).toBe("2026-07-21");
		expect(nextDueDate({ ...base, rule: "weekly" })).toBe("2026-07-27");
		expect(nextDueDate({ ...base, rule: "biweekly" })).toBe("2026-08-03");
		expect(nextDueDate({ ...base, rule: "monthly" })).toBe("2026-08-20");
		expect(nextDueDate({ ...base, rule: "yearly" })).toBe("2027-07-20");
	});

	it("advances from today when the task is overdue (never re-spawns in the past)", () => {
		const next = nextDueDate({ currentDue: "2026-06-01", rule: "weekly", todayIso: "2026-07-14" });
		expect(next).toBe("2026-07-21");
	});

	it("clamps month-end: Jan 31 + 1 month lands on the last day of February", () => {
		expect(nextDueDate({ currentDue: "2026-01-31", rule: "monthly", todayIso: "2026-01-01" })).toBe(
			"2026-02-28",
		);
		// Leap year.
		expect(nextDueDate({ currentDue: "2024-01-31", rule: "monthly", todayIso: "2024-01-01" })).toBe(
			"2024-02-29",
		);
	});

	it("weekdays skips Saturday and Sunday", () => {
		// 2026-07-17 is a Friday → next weekday is Monday the 20th.
		expect(
			nextDueDate({ currentDue: "2026-07-17", rule: "weekdays", todayIso: "2026-07-01" }),
		).toBe("2026-07-20");
	});

	it("handles year rollover", () => {
		expect(nextDueDate({ currentDue: "2026-12-31", rule: "daily", todayIso: "2026-12-31" })).toBe(
			"2027-01-01",
		);
	});
});

describe("periodStart", () => {
	// 2026-07-14 is a Tuesday.
	const tue = Date.parse("2026-07-14T15:00:00Z");

	it("daily starts today at 00:00 UTC", () => {
		expect(periodStart("daily", tue)).toBe(Date.parse("2026-07-14T00:00:00Z"));
	});

	it("weekly anchors on Monday", () => {
		expect(periodStart("weekly", tue)).toBe(Date.parse("2026-07-13T00:00:00Z"));
	});

	it("weekdays on Sunday reaches back to Friday", () => {
		const sun = Date.parse("2026-07-12T12:00:00Z");
		expect(periodStart("weekdays", sun)).toBe(Date.parse("2026-07-10T00:00:00Z"));
	});

	it("monthly / yearly / semiannual anchors", () => {
		expect(periodStart("monthly", tue)).toBe(Date.parse("2026-07-01T00:00:00Z"));
		expect(periodStart("yearly", tue)).toBe(Date.parse("2026-01-01T00:00:00Z"));
		expect(periodStart("semiannually", tue)).toBe(Date.parse("2026-07-01T00:00:00Z"));
	});
});

describe("isCurrentlyDoneRecurring", () => {
	const now = Date.parse("2026-07-14T15:00:00Z");

	it("true when done within the current period", () => {
		expect(isCurrentlyDoneRecurring(true, "2026-07-14T08:00:00Z", "daily", now)).toBe(true);
	});

	it("false when the done timestamp predates the period", () => {
		expect(isCurrentlyDoneRecurring(true, "2026-07-13T08:00:00Z", "daily", now)).toBe(false);
	});

	it("false when not done or timestamp missing/garbage", () => {
		expect(isCurrentlyDoneRecurring(false, "2026-07-14T08:00:00Z", "daily", now)).toBe(false);
		expect(isCurrentlyDoneRecurring(true, null, "daily", now)).toBe(false);
		expect(isCurrentlyDoneRecurring(true, "not-a-date", "daily", now)).toBe(false);
	});
});
