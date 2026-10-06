import { describe, expect, it } from "vitest";
import { calendarHealth, describeFeedHealth, STALE_AFTER_MS } from "@/lib/calendar-health";

const TZ = "America/Sao_Paulo";
// Tuesday 6 Oct 2026, 15:00 in São Paulo.
const NOW = Date.parse("2026-10-06T18:00:00.000Z");
const TODAY = "2026-10-06";

const ago = (ms: number) => new Date(NOW - ms).toISOString();
const ok = (at: string) => ({ last_synced_at: at, last_result: { pulled: 0, removed: 0 } });

describe("calendarHealth", () => {
	it("says nothing when both feeds synced recently", () => {
		expect(calendarHealth({ work: ok(ago(15 * 60_000)), icloud: ok(ago(60_000)) }, NOW)).toEqual(
			[],
		);
	});

	it("says nothing about a feed that has never synced", () => {
		expect(calendarHealth({ work: null, icloud: null }, NOW)).toEqual([]);
		expect(
			calendarHealth({ work: { last_synced_at: null, last_result: null }, icloud: null }, NOW),
		).toEqual([]);
	});

	it("flags a feed with no success for longer than the threshold", () => {
		const at = ago(STALE_AFTER_MS + 1);
		expect(calendarHealth({ work: ok(at), icloud: ok(ago(60_000)) }, NOW)).toEqual([
			{ feed: "work", status: "stale", at },
		]);
	});

	it("flags a failed run at once, whatever its age", () => {
		const at = ago(60_000);
		const icloud = { last_synced_at: at, last_result: { error: "Gateway Timeout" } };
		expect(calendarHealth({ work: null, icloud }, NOW)).toEqual([
			{ feed: "icloud", status: "failed", at },
		]);
	});
});

describe("describeFeedHealth", () => {
	it("gives the time alone for today", () => {
		expect(
			describeFeedHealth(
				{ feed: "icloud", status: "failed", at: "2026-10-06T17:10:00.000Z" },
				TZ,
				TODAY,
			),
		).toBe("iCloud calendar sync failed at 14:10.");
	});

	it("gives the weekday this week, and says the Mac has not reported", () => {
		expect(
			describeFeedHealth(
				{ feed: "work", status: "stale", at: "2026-10-02T21:04:00.000Z" },
				TZ,
				TODAY,
			),
		).toBe("Work calendar last synced Fri 18:04. The Mac bridge has not reported since.");
	});

	it("gives the date when it is older than a week", () => {
		expect(
			describeFeedHealth(
				{ feed: "icloud", status: "stale", at: "2026-09-12T21:15:00.000Z" },
				TZ,
				TODAY,
			),
		).toBe("iCloud calendar last synced 12 Sep, 18:15.");
	});
});
