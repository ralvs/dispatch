import { describe, expect, it } from "vitest";
import {
	formatCustomWeekly,
	isCurrentlyDoneRecurring,
	isRecurrenceRule,
	nextDueDate,
	parseCustomWeekly,
	periodStart,
	RECURRENCE_LABELS,
	RECURRENCE_PATTERNS,
	recurrenceLabel,
} from "./recurrence";

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

describe("recurrenceLabel", () => {
	it("returns the human label for every known pattern", () => {
		for (const pattern of RECURRENCE_PATTERNS) {
			expect(recurrenceLabel(pattern)).toBe(RECURRENCE_LABELS[pattern]);
		}
	});

	it("returns null for null, undefined, and unknown strings", () => {
		expect(recurrenceLabel(null)).toBeNull();
		expect(recurrenceLabel(undefined)).toBeNull();
		expect(recurrenceLabel("fortnightly")).toBeNull();
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

describe("parseCustomWeekly", () => {
	it("reads the weekday codes into day numbers", () => {
		expect(parseCustomWeekly("weekly:tu,sa")).toEqual([2, 6]);
	});

	it("sorts regardless of the order written", () => {
		expect(parseCustomWeekly("weekly:sa,tu")).toEqual([2, 6]);
	});

	it("is null for the seven plain literals", () => {
		expect(parseCustomWeekly("weekly")).toBeNull();
		expect(parseCustomWeekly("weekdays")).toBeNull();
	});

	it("is null for a malformed rule rather than a partial one", () => {
		expect(parseCustomWeekly("weekly:")).toBeNull();
		expect(parseCustomWeekly("weekly:xx")).toBeNull();
		expect(parseCustomWeekly("weekly:tu,tu")).toBeNull();
		expect(parseCustomWeekly(null)).toBeNull();
	});
});

describe("formatCustomWeekly", () => {
	it("round-trips through parseCustomWeekly", () => {
		expect(parseCustomWeekly(formatCustomWeekly([6, 2]))).toEqual([2, 6]);
	});

	it("is the empty string for no days, which means no rule", () => {
		expect(formatCustomWeekly([])).toBe("");
	});
});

describe("recurrenceLabel · custom weekly", () => {
	it("names the weekdays", () => {
		expect(recurrenceLabel("weekly:tu,sa")).toBe("Tue, Sat");
	});

	it("stays null for a rule it cannot read", () => {
		expect(recurrenceLabel("weekly:nope")).toBeNull();
	});
});

describe("nextDueDate · custom weekly", () => {
	// 2026-09-06 is a Sunday.
	it("advances to the next listed weekday", () => {
		expect(nextDueDate({ currentDue: null, rule: "weekly:tu,sa", todayIso: "2026-09-06" })).toBe(
			"2026-09-08",
		);
	});

	it("wraps to the following week when the last listed day has passed", () => {
		// Saturday 2026-09-12 → next Tuesday.
		expect(
			nextDueDate({ currentDue: "2026-09-12", rule: "weekly:tu,sa", todayIso: "2026-09-06" }),
		).toBe("2026-09-15");
	});

	it("rolls from today when the task is overdue", () => {
		expect(
			nextDueDate({ currentDue: "2026-08-01", rule: "weekly:tu,sa", todayIso: "2026-09-06" }),
		).toBe("2026-09-08");
	});

	it("handles a single listed day", () => {
		expect(nextDueDate({ currentDue: null, rule: "weekly:su", todayIso: "2026-09-06" })).toBe(
			"2026-09-13",
		);
	});
});

describe("isRecurrenceRule", () => {
	it("accepts the literals and the custom form, and nothing else", () => {
		expect(isRecurrenceRule("weekly")).toBe(true);
		expect(isRecurrenceRule("weekly:tu,sa")).toBe(true);
		expect(isRecurrenceRule("every 3 weeks")).toBe(false);
	});
});

describe("periodStart · custom weekly", () => {
	it("shares plain weekly's Monday-anchored window", () => {
		const now = Date.parse("2026-09-06T12:00:00.000Z");
		expect(periodStart("weekly:tu,sa", now)).toBe(periodStart("weekly", now));
	});
});
