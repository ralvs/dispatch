import { describe, expect, it } from "vitest";
import {
	formatCustomWeekly,
	isRecurrenceRule,
	nextOccurrence,
	parseCustomWeekly,
	RECURRENCE_LABELS,
	RECURRENCE_PATTERNS,
	recurrenceLabel,
} from "./recurrence";

// The due date the roll lands on, for the cases that ignore recurrenceDay.
function nextDue(currentDue: string | null, rule: string, todayIso: string): string {
	return nextOccurrence({ currentDue, rule, todayIso }).dueDate;
}

describe("nextOccurrence · due date", () => {
	it("steps each pattern forward from the due date", () => {
		const step = (rule: string) => nextDue("2026-07-20", rule, "2026-07-14");
		expect(step("daily")).toBe("2026-07-21");
		expect(step("weekly")).toBe("2026-07-27");
		expect(step("biweekly")).toBe("2026-08-03");
		expect(step("monthly")).toBe("2026-08-20");
		expect(step("yearly")).toBe("2027-07-20");
	});

	it.each([
		// Due Saturday, ticked Monday → next Saturday, not next Monday.
		[
			"keeps the due weekday when a weekly task is ticked late",
			"2026-09-19",
			"weekly",
			"2026-09-21",
			"2026-09-26",
		],
		// Monday 06-01, ticked Tuesday 07-14 → the next Monday. Never re-spawns in the past.
		[
			"skips missed occurrences but stays on the cadence (never re-spawns in the past) · weekly",
			"2026-06-01",
			"weekly",
			"2026-07-14",
			"2026-07-20",
		],
		// 06-01 + 14k lands on 07-27, not 07-20.
		[
			"skips missed occurrences but stays on the cadence (never re-spawns in the past) · biweekly keeps its parity",
			"2026-06-01",
			"biweekly",
			"2026-07-14",
			"2026-07-27",
		],
		[
			"skips missed occurrences but stays on the cadence (never re-spawns in the past) · monthly",
			"2026-03-10",
			"monthly",
			"2026-05-20",
			"2026-06-10",
		],
		[
			"skips missed occurrences but stays on the cadence (never re-spawns in the past) · daily",
			"2026-06-01",
			"daily",
			"2026-07-14",
			"2026-07-15",
		],
		[
			"moves a full interval when ticked on the due day",
			"2026-09-26",
			"weekly",
			"2026-09-26",
			"2026-10-03",
		],
		["steps from today when there is no due date", null, "weekly", "2026-09-21", "2026-09-28"],
		[
			"keeps the day of the month: the 15th stays on the 15th",
			"2026-09-15",
			"monthly",
			"2026-09-15",
			"2026-10-15",
		],
		[
			"keeps the day of the month: the 15th stays on the 15th · ticked late",
			"2026-09-15",
			"monthly",
			"2026-09-20",
			"2026-10-15",
		],
		// Jan 31 → Feb 28 (clamped) → Mar 31, not Mar 28.
		[
			"counts month steps from the due date, so catching up does not drift",
			"2026-01-31",
			"monthly",
			"2026-03-01",
			"2026-03-31",
		],
		[
			"clamps month-end: Jan 31 + 1 month lands on the last day of February",
			"2026-01-31",
			"monthly",
			"2026-01-01",
			"2026-02-28",
		],
		[
			"clamps month-end: Jan 31 + 1 month lands on the last day of February · leap year",
			"2024-01-31",
			"monthly",
			"2024-01-01",
			"2024-02-29",
		],
		// 2026-07-17 is a Friday.
		["weekdays skips Saturday and Sunday", "2026-07-17", "weekdays", "2026-07-01", "2026-07-20"],
		["handles year rollover", "2026-12-31", "daily", "2026-12-31", "2027-01-01"],
		// Custom weekly. 2026-09-06 is a Sunday.
		[
			"custom weekly · advances to the next listed weekday",
			null,
			"weekly:tu,sa",
			"2026-09-06",
			"2026-09-08",
		],
		[
			"custom weekly · wraps to the following week when the last listed day has passed",
			"2026-09-12",
			"weekly:tu,sa",
			"2026-09-06",
			"2026-09-15",
		],
		[
			"custom weekly · rolls from today when the task is overdue",
			"2026-08-01",
			"weekly:tu,sa",
			"2026-09-06",
			"2026-09-08",
		],
		["custom weekly · handles a single listed day", null, "weekly:su", "2026-09-06", "2026-09-13"],
	] as const)("%s", (_name, currentDue, rule, todayIso, expected) => {
		expect(nextDue(currentDue, rule, todayIso)).toBe(expected);
	});

	it("keeps the weekday for weekly: a Monday series stays on Mondays", () => {
		// Monday 2026-09-21, ticked early on Friday, on time, and two weeks late.
		for (const todayIso of ["2026-09-18", "2026-09-21", "2026-10-06"]) {
			const next = nextDue("2026-09-21", "weekly", todayIso);
			expect(new Date(`${next}T12:00:00Z`).getUTCDay()).toBe(1);
		}
	});
});

describe("nextOccurrence · the 31st across short months", () => {
	// Tick each occurrence on its due day, carrying recurrenceDay forward the
	// way completeTask copies it onto the spawned row.
	function series(start: string, rule: string, steps: number): string[] {
		let due = start;
		let recurrenceDay: number | null = null;
		const out: string[] = [];
		for (let i = 0; i < steps; i++) {
			const next = nextOccurrence({ currentDue: due, rule, todayIso: due, recurrenceDay });
			due = next.dueDate;
			recurrenceDay = next.recurrenceDay;
			out.push(due);
		}
		return out;
	}

	it("clamps to a short month's last day, then returns to the 31st", () => {
		expect(series("2026-01-31", "monthly", 6)).toEqual([
			"2026-02-28",
			"2026-03-31",
			"2026-04-30",
			"2026-05-31",
			"2026-06-30",
			"2026-07-31",
		]);
	});

	it("uses Feb 29 in a leap year and still returns to the 30th", () => {
		expect(series("2028-01-30", "monthly", 3)).toEqual(["2028-02-29", "2028-03-30", "2028-04-30"]);
	});

	it("keeps Feb 29 for a yearly series", () => {
		expect(series("2028-02-29", "yearly", 5)).toEqual([
			"2029-02-28",
			"2030-02-28",
			"2031-02-28",
			"2032-02-29",
			"2033-02-28",
		]);
	});

	it("keeps the 31st across a six-month step", () => {
		expect(series("2026-08-31", "semiannually", 2)).toEqual(["2027-02-28", "2027-08-31"]);
	});

	it("stores the intended day only while the due date is clamped", () => {
		expect(
			nextOccurrence({ currentDue: "2026-01-31", rule: "monthly", todayIso: "2026-01-31" }),
		).toEqual({ dueDate: "2026-02-28", recurrenceDay: 31 });
		expect(
			nextOccurrence({
				currentDue: "2026-02-28",
				rule: "monthly",
				todayIso: "2026-02-28",
				recurrenceDay: 31,
			}),
		).toEqual({ dueDate: "2026-03-31", recurrenceDay: null });
	});

	it("drops the stored day when the due date was moved off the month end", () => {
		// Clamped Feb 28 moved by hand to Feb 15: the 15th is the new day.
		expect(
			nextOccurrence({
				currentDue: "2026-02-15",
				rule: "monthly",
				todayIso: "2026-02-15",
				recurrenceDay: 31,
			}),
		).toEqual({ dueDate: "2026-03-15", recurrenceDay: null });
	});

	it("never stores a day for day-stepped rules", () => {
		expect(
			nextOccurrence({
				currentDue: "2026-04-30",
				rule: "weekly",
				todayIso: "2026-04-30",
				recurrenceDay: 31,
			}),
		).toEqual({ dueDate: "2026-05-07", recurrenceDay: null });
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

describe("isRecurrenceRule", () => {
	it("accepts the literals and the custom form, and nothing else", () => {
		expect(isRecurrenceRule("weekly")).toBe(true);
		expect(isRecurrenceRule("weekly:tu,sa")).toBe(true);
		expect(isRecurrenceRule("every 3 weeks")).toBe(false);
	});
});
