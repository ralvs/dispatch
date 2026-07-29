import { describe, expect, it } from "vitest";
import { computeTapeRange } from "./day-tape";

describe("computeTapeRange", () => {
	it("pads and snaps around events + now, dropping empty early/late hours", () => {
		// Events at 10:00 and 18:00, now 15:00 → roughly 09:00–19:00
		const { startMin, endMin, ticks } = computeTapeRange([10 * 60, 18 * 60], 15 * 60);
		expect(startMin).toBe(9 * 60);
		expect(endMin).toBe(19 * 60);
		expect(ticks[0]).toBe(9);
		expect(ticks[ticks.length - 1]).toBe(19);
		// No 06:00 / 24:00 on a mid-day cluster
		expect(ticks).not.toContain(6);
		expect(ticks).not.toContain(24);
	});

	it("expands a tight cluster to a readable minimum span", () => {
		const { startMin, endMin } = computeTapeRange([12 * 60], 12 * 60 + 30);
		expect(endMin - startMin).toBeGreaterThanOrEqual(6 * 60);
	});

	it("falls back to a daytime window when there are no points", () => {
		const { startMin, endMin } = computeTapeRange([], Number.NaN);
		expect(startMin).toBe(8 * 60);
		expect(endMin).toBe(20 * 60);
	});

	it("clamps to the calendar day", () => {
		const { startMin, endMin } = computeTapeRange([0], 30);
		expect(startMin).toBe(0);
		expect(endMin).toBeLessThanOrEqual(24 * 60);
	});
});

describe("computeTapeRange without a now", () => {
	it("fits the events alone on a day that is not today", () => {
		// 14:00–16:00 pads to 13:00–17:00, then widens to the 6h minimum span.
		const { startMin, endMin } = computeTapeRange([14 * 60, 16 * 60], null);
		expect(startMin).toBe(12 * 60);
		expect(endMin).toBe(18 * 60);
	});

	it("ignores a now that would otherwise stretch the window", () => {
		const withNow = computeTapeRange([14 * 60], 22 * 60);
		const withoutNow = computeTapeRange([14 * 60], null);
		expect(withNow.endMin).toBeGreaterThan(withoutNow.endMin);
	});

	it("still falls back to a daytime window when the day is empty", () => {
		const { startMin, endMin } = computeTapeRange([], null);
		expect(startMin).toBe(8 * 60);
		expect(endMin).toBe(20 * 60);
	});
});
