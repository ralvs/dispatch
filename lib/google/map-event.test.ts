import { describe, expect, it } from "vitest";
import { type GoogleRemoteEvent, mapGoogleEvent } from "@/lib/google/map-event";

function base(overrides: Partial<GoogleRemoteEvent> = {}): GoogleRemoteEvent {
	return {
		id: "evt-1",
		etag: '"abc"',
		status: "confirmed",
		summary: "Standup",
		start: { dateTime: "2026-07-21T14:00:00-03:00" },
		end: { dateTime: "2026-07-21T14:30:00-03:00" },
		...overrides,
	};
}

describe("mapGoogleEvent", () => {
	it("maps a timed event to UTC instants", () => {
		expect(mapGoogleEvent(base())).toMatchObject({
			uid: "evt-1",
			allDay: false,
			startUtc: "2026-07-21T17:00:00.000Z",
			endUtc: "2026-07-21T17:30:00.000Z",
		});
	});

	it("maps all-day exclusive end dates", () => {
		expect(
			mapGoogleEvent(
				base({
					start: { date: "2026-07-21" },
					end: { date: "2026-07-22" },
				}),
			),
		).toMatchObject({
			allDay: true,
			startUtc: "2026-07-21T00:00:00.000Z",
			endUtc: "2026-07-22T00:00:00.000Z",
		});
	});

	it("returns null for cancelled events", () => {
		expect(mapGoogleEvent(base({ status: "cancelled" }))).toBeNull();
	});
});
