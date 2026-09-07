import { describe, expect, it } from "vitest";
import type { DayScheduleItem } from "@/lib/day-schedule";
import {
	computeTapeWindow,
	formatTapeTime,
	minutesFromRatio,
	TAPE_END_MIN,
	TAPE_START_MIN,
	tapeBlocks,
} from "./day-tape";

// The window is pinned at 06:00–22:00 and only ever widens. It replaces a
// window that fitted itself to the day's contents — which made a 30-minute
// meeting a different width every morning, and a proportional measure you
// cannot compare between days is not measuring anything.

describe("computeTapeWindow", () => {
	it("holds 06:00–22:00 for an ordinary day", () => {
		const { startMin, endMin } = computeTapeWindow([10 * 60, 18 * 60], 15 * 60);
		expect(startMin).toBe(TAPE_START_MIN);
		expect(endMin).toBe(TAPE_END_MIN);
	});

	it("holds the same window when the day is empty", () => {
		const { startMin, endMin } = computeTapeWindow([], null);
		expect(startMin).toBe(6 * 60);
		expect(endMin).toBe(22 * 60);
	});

	it("does not shrink to a tight cluster", () => {
		const { startMin, endMin } = computeTapeWindow([12 * 60], 12 * 60 + 30);
		expect(startMin).toBe(6 * 60);
		expect(endMin).toBe(22 * 60);
	});

	it("widens to a whole hour for an early item", () => {
		const { startMin, endMin } = computeTapeWindow([5 * 60 + 20], null);
		expect(startMin).toBe(5 * 60);
		expect(endMin).toBe(22 * 60);
	});

	it("widens to a whole hour for a late item", () => {
		const { startMin, endMin } = computeTapeWindow([23 * 60 + 10], null);
		expect(startMin).toBe(6 * 60);
		expect(endMin).toBe(24 * 60);
	});

	it("widens for `now` too, so the mark is never clamped to an edge", () => {
		const { startMin } = computeTapeWindow([9 * 60], 4 * 60 + 45);
		expect(startMin).toBe(4 * 60);
	});

	it("clamps to the calendar day", () => {
		const { startMin, endMin } = computeTapeWindow([0, 24 * 60], 30);
		expect(startMin).toBe(0);
		expect(endMin).toBe(24 * 60);
	});

	it("rules every three hours, always closing on the right edge", () => {
		const { ticks } = computeTapeWindow([], null);
		expect(ticks).toEqual([6, 9, 12, 15, 18, 21, 22]);
	});
});

function event(key: string, time: string, startAt: string, endAt: string): DayScheduleItem {
	return {
		kind: "event",
		key,
		sortAt: startAt,
		time,
		// Only the three fields the tape reads are needed here.
		event: {
			id: key,
			title: key,
			start_at: startAt,
			end_at: endAt,
			all_day: false,
			location: null,
			calendar_name: "Work",
		} as DayScheduleItem extends { kind: "event"; event: infer E } ? E : never,
	};
}

describe("minutesFromRatio / formatTapeTime", () => {
	it("maps the edges to the window ends", () => {
		expect(minutesFromRatio(0, TAPE_START_MIN, TAPE_END_MIN)).toBe(TAPE_START_MIN);
		expect(minutesFromRatio(1, TAPE_START_MIN, TAPE_END_MIN)).toBe(TAPE_END_MIN);
	});

	it("rounds to the nearest minute in the middle of the day", () => {
		// Halfway through 06:00–22:00 is 14:00 exactly.
		expect(minutesFromRatio(0.5, TAPE_START_MIN, TAPE_END_MIN)).toBe(14 * 60);
		expect(formatTapeTime(14 * 60 + 7)).toBe("14:07");
	});

	it("clamps ratios that fall outside 0–1", () => {
		expect(minutesFromRatio(-0.2, TAPE_START_MIN, TAPE_END_MIN)).toBe(TAPE_START_MIN);
		expect(minutesFromRatio(1.4, TAPE_START_MIN, TAPE_END_MIN)).toBe(TAPE_END_MIN);
	});
});

describe("tapeBlocks", () => {
	it("gives an event its real duration and a task no width at all", () => {
		const blocks = tapeBlocks([
			event("standup", "10:00", "2026-08-07T13:00:00Z", "2026-08-07T13:30:00Z"),
		]);
		expect(blocks).toHaveLength(1);
		expect(blocks[0]).toMatchObject({ kind: "event", startMin: 600, durationMin: 30 });
	});

	it("drops items with no time — they belong to the all-day band", () => {
		const timed = event("standup", "10:00", "2026-08-07T13:00:00Z", "2026-08-07T13:30:00Z");
		const untimed = { ...timed, key: "allday", time: null } as DayScheduleItem;
		expect(tapeBlocks([timed, untimed])).toHaveLength(1);
	});

	it("orders by clock, so the tape assembles left to right", () => {
		const blocks = tapeBlocks([
			event("late", "18:00", "2026-08-07T21:00:00Z", "2026-08-07T22:00:00Z"),
			event("early", "09:00", "2026-08-07T12:00:00Z", "2026-08-07T12:30:00Z"),
		]);
		expect(blocks.map((b) => b.key)).toEqual(["early", "late"]);
	});
});

// Two meetings at the same hour used to be one block: the later drew over the
// earlier and a double-booked morning read as a single commitment. They now
// split the track into rows, per cluster of touching events rather than per
// day, so one clash does not halve every other meeting.

describe("overlapping events", () => {
	it("puts two events at the same hour in two rows", () => {
		const blocks = tapeBlocks([
			event("a", "09:00", "2026-08-07T12:00:00Z", "2026-08-07T13:00:00Z"),
			event("b", "09:30", "2026-08-07T12:30:00Z", "2026-08-07T13:30:00Z"),
		]);
		expect(blocks.map((b) => [b.lane, b.lanes])).toEqual([
			[0, 2],
			[1, 2],
		]);
	});

	it("keeps back-to-back events in one row", () => {
		const blocks = tapeBlocks([
			event("a", "09:00", "2026-08-07T12:00:00Z", "2026-08-07T13:00:00Z"),
			event("b", "10:00", "2026-08-07T13:00:00Z", "2026-08-07T14:00:00Z"),
		]);
		expect(blocks.every((b) => b.lane === 0 && b.lanes === 1)).toBe(true);
	});

	it("splits only the cluster that clashes, not the whole day", () => {
		const blocks = tapeBlocks([
			event("clash-a", "09:00", "2026-08-07T12:00:00Z", "2026-08-07T13:00:00Z"),
			event("clash-b", "09:30", "2026-08-07T12:30:00Z", "2026-08-07T13:30:00Z"),
			event("alone", "15:00", "2026-08-07T18:00:00Z", "2026-08-07T19:00:00Z"),
		]);
		const alone = blocks.find((b) => b.key === "alone");
		expect(alone).toMatchObject({ lane: 0, lanes: 1 });
	});

	it("gives a three-deep clash three rows and reuses a freed one", () => {
		const blocks = tapeBlocks([
			event("a", "09:00", "2026-08-07T12:00:00Z", "2026-08-07T13:00:00Z"),
			event("b", "09:15", "2026-08-07T12:15:00Z", "2026-08-07T13:15:00Z"),
			event("c", "09:30", "2026-08-07T12:30:00Z", "2026-08-07T13:30:00Z"),
			// Starts after `a` ends, so it takes `a`'s row back.
			event("d", "10:00", "2026-08-07T13:00:00Z", "2026-08-07T14:00:00Z"),
		]);
		const lane = (key: string) => blocks.find((b) => b.key === key)?.lane;
		expect([lane("a"), lane("b"), lane("c"), lane("d")]).toEqual([0, 1, 2, 0]);
		expect(blocks.every((b) => b.lanes === 3)).toBe(true);
	});
});
