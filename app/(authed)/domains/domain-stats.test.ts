import { describe, expect, it } from "vitest";
import type { DomainTouch } from "@/lib/services/observations";
import { domainStats } from "./domain-stats";

function touch(patch: Partial<DomainTouch> = {}): DomainTouch {
	return {
		domainId: "d",
		name: "Health",
		lastTouchUtc: "2026-09-01T00:00:00.000Z",
		daysSinceTouch: 2,
		thresholdDays: 7,
		openTasks: 0,
		quiet: false,
		...patch,
	};
}

describe("domainStats", () => {
	it("counts only domains that have a cadence rule", () => {
		const stats = domainStats([touch(), touch({ thresholdDays: null, quiet: false })]);

		expect(stats[0]).toMatchObject({ value: 1, label: "within cadence" });
		expect(stats[1]).toMatchObject({ value: 0, label: "gone quiet" });
	});

	it("spends the orange only when something is quiet", () => {
		expect(domainStats([touch()])[1].attention).toBe(false);
		expect(domainStats([touch({ quiet: true })])[1].attention).toBe(true);
	});

	it("reports the longest quiet run in days", () => {
		const stats = domainStats([
			touch({ quiet: true, daysSinceTouch: 9 }),
			touch({ quiet: true, daysSinceTouch: 31 }),
			touch({ daysSinceTouch: 900 }),
		]);

		expect(stats[2]).toMatchObject({ value: "31d", label: "longest quiet run" });
	});

	it("shows a dash when nothing is quiet, and ignores never-touched runs", () => {
		expect(domainStats([touch()])[2].value).toBe("—");
		expect(domainStats([touch({ quiet: true, daysSinceTouch: null })])[2].value).toBe("—");
	});
});
