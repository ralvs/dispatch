import { describe, expect, it } from "vitest";
import { computeRoutineStats, recentDaysGrid } from "./routine-stats";

const TODAY = "2026-07-14";

describe("computeRoutineStats", () => {
	it("counts a current streak ending today", () => {
		const stats = computeRoutineStats(["2026-07-12", "2026-07-13", "2026-07-14"], TODAY);
		expect(stats.current_streak).toBe(3);
		expect(stats.done_today).toBe(true);
	});

	it("keeps the streak alive if only today is missing", () => {
		const stats = computeRoutineStats(["2026-07-12", "2026-07-13"], TODAY);
		expect(stats.current_streak).toBe(2);
		expect(stats.done_today).toBe(false);
	});

	it("breaks the streak after a full missed day", () => {
		const stats = computeRoutineStats(["2026-07-11", "2026-07-12"], TODAY);
		expect(stats.current_streak).toBe(0);
	});

	it("longest streak survives gaps and is >= current", () => {
		const stats = computeRoutineStats(
			["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-13", "2026-07-14"],
			TODAY,
		);
		expect(stats.longest_streak).toBe(4);
		expect(stats.current_streak).toBe(2);
	});

	it("windows are inclusive of today and bounded", () => {
		const stats = computeRoutineStats(
			["2026-07-14", "2026-07-08", "2026-07-07", "2026-06-15", "2026-05-01"],
			TODAY,
		);
		expect(stats.completions_7d).toBe(2); // 14th and 8th (7th is 7 days back → outside)
		expect(stats.completions_30d).toBe(4); // + 7th and Jun 15
		expect(stats.total).toBe(5);
	});
});

describe("recentDaysGrid", () => {
	it("returns the requested window oldest-first with today flagged", () => {
		const grid = recentDaysGrid(["2026-07-13"], TODAY, 3);
		expect(grid.map((c) => c.date)).toEqual(["2026-07-12", "2026-07-13", "2026-07-14"]);
		expect(grid[1]?.done).toBe(true);
		expect(grid[2]?.isToday).toBe(true);
	});
});
