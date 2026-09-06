import { describe, expect, it } from "vitest";
import {
	daysBetween,
	laterOf,
	neglectObservationBody,
	resolveTouch,
} from "@/lib/services/observations";

const TODAY = "2026-09-06";
const SP = "America/Sao_Paulo";

function touchInput(patch: Partial<Parameters<typeof resolveTouch>[0]> = {}) {
	return {
		domainId: "domain-1",
		name: "Health",
		failurePatterns: [{ rule: "no_activity_days", value: 7 }],
		lastShippedAt: null,
		lastTaskDoneAt: null,
		lastProjectActivityAt: null,
		lastNoteAt: null,
		openTasks: 0,
		todayIso: TODAY,
		tz: SP,
		...patch,
	};
}

describe("laterOf", () => {
	it("returns the other side when one is null", () => {
		expect(laterOf(null, "2026-01-01T00:00:00.000Z")).toBe("2026-01-01T00:00:00.000Z");
		expect(laterOf("2026-01-01T00:00:00.000Z", null)).toBe("2026-01-01T00:00:00.000Z");
		expect(laterOf(null, null)).toBeNull();
	});

	it("returns the later instant", () => {
		expect(laterOf("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z")).toBe(
			"2026-02-01T00:00:00.000Z",
		);
	});
});

describe("daysBetween", () => {
	it("counts calendar days in the app timezone, not elapsed 24h blocks", () => {
		expect(daysBetween("2026-09-04T13:00:00.000Z", TODAY, SP)).toBe(2);
	});

	it("puts a late-evening UTC instant on the app timezone's own day", () => {
		// 02:00 UTC on the 5th is still 23:00 on the 4th in São Paulo, so this
		// is two calendar days back, not one.
		expect(daysBetween("2026-09-05T02:00:00.000Z", TODAY, SP)).toBe(2);
	});

	it("never goes negative for a future instant", () => {
		expect(daysBetween("2026-10-01T00:00:00.000Z", TODAY, SP)).toBe(0);
	});

	it("degrades to 0 on a malformed instant rather than throwing", () => {
		expect(daysBetween("not-a-date", TODAY, SP)).toBe(0);
	});
});

describe("resolveTouch", () => {
	it("takes the latest of every source", () => {
		const touch = resolveTouch(
			touchInput({
				lastShippedAt: "2026-08-01T00:00:00.000Z",
				lastTaskDoneAt: "2026-09-05T00:00:00.000Z",
				lastProjectActivityAt: "2026-07-01T00:00:00.000Z",
			}),
		);

		expect(touch.lastTouchUtc).toBe("2026-09-05T00:00:00.000Z");
		// 00:00 UTC on the 5th is 21:00 on the 4th in São Paulo.
		expect(touch.daysSinceTouch).toBe(2);
		expect(touch.quiet).toBe(false);
	});

	it("goes quiet once the threshold is passed", () => {
		const touch = resolveTouch(touchInput({ lastTaskDoneAt: "2026-08-20T00:00:00.000Z" }));

		expect(touch.daysSinceTouch).toBe(18);
		expect(touch.quiet).toBe(true);
	});

	it("treats a never-touched domain with a rule as quiet", () => {
		const touch = resolveTouch(touchInput());

		expect(touch.lastTouchUtc).toBeNull();
		expect(touch.daysSinceTouch).toBeNull();
		expect(touch.quiet).toBe(true);
	});

	it("never flags a domain with no cadence rule", () => {
		const touch = resolveTouch(touchInput({ failurePatterns: [] }));

		expect(touch.thresholdDays).toBeNull();
		expect(touch.quiet).toBe(false);
	});

	it("counts only the open tasks it is handed", () => {
		expect(resolveTouch(touchInput({ openTasks: 3 })).openTasks).toBe(3);
	});
});

describe("neglectObservationBody", () => {
	it("says so when nothing has ever touched the domain", () => {
		const touch = resolveTouch(touchInput());
		expect(neglectObservationBody(touch)).toBe("Never touched — flags after 7 days.");
	});

	it("singularises one day", () => {
		const touch = resolveTouch(
			touchInput({
				failurePatterns: [{ rule: "no_activity_days", value: 1 }],
				lastTaskDoneAt: "2026-09-05T00:00:00.000Z",
			}),
		);
		expect(neglectObservationBody(touch)).toBe("2 days since the last touch — flags after 1 day.");
	});
});

describe("resolveTouch · open task count", () => {
	it("takes the count it is handed — the fold excludes wants upstream", () => {
		expect(resolveTouch(touchInput({ openTasks: 2 })).openTasks).toBe(2);
	});
});
