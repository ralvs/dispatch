import { describe, expect, it } from "vitest";
import { whyNotEditable } from "./calendar-edit";

const ON_RENAN = { source: "caldav", calendar_name: "Renan", recurring: false } as const;

describe("whyNotEditable", () => {
	it("allows a single event on the write calendar, from a sync or created here", () => {
		expect(whyNotEditable(ON_RENAN, "Renan")).toBeNull();
		expect(whyNotEditable({ ...ON_RENAN, source: "created_here" }, "Renan")).toBeNull();
	});

	it("refuses a work event", () => {
		expect(whyNotEditable({ ...ON_RENAN, source: "google" }, "Renan")).toMatch(/work event/);
	});

	it("refuses an event on another iCloud calendar", () => {
		expect(whyNotEditable({ ...ON_RENAN, calendar_name: "Nivers" }, "Renan")).toMatch(
			/"Nivers" calendar/,
		);
	});

	it("refuses a series, and an event whose kind is not known yet", () => {
		expect(whyNotEditable({ ...ON_RENAN, recurring: true }, "Renan")).toMatch(/repeats/);
		expect(whyNotEditable({ ...ON_RENAN, recurring: null }, "Renan")).toMatch(/not synced/);
	});

	it("refuses everything when no write calendar is set", () => {
		expect(whyNotEditable(ON_RENAN, undefined)).toMatch(/not set up/);
	});
});
