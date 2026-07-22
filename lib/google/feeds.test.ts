import { describe, expect, it } from "vitest";
import { parseGoogleIcsFeeds } from "@/lib/google/feeds";

describe("parseGoogleIcsFeeds", () => {
	it("returns empty for unset or blank", () => {
		expect(parseGoogleIcsFeeds(undefined)).toEqual([]);
		expect(parseGoogleIcsFeeds("  ")).toEqual([]);
	});

	it("parses a single Name|url pair", () => {
		expect(
			parseGoogleIcsFeeds("Work|https://calendar.google.com/calendar/ical/x/private-y/basic.ics"),
		).toEqual([
			{
				name: "Work",
				url: "https://calendar.google.com/calendar/ical/x/private-y/basic.ics",
			},
		]);
	});

	it("parses multiple semicolon-separated feeds", () => {
		const raw =
			"Work|https://calendar.google.com/a/basic.ics;Team Stuff|https://calendar.google.com/b/basic.ics";
		expect(parseGoogleIcsFeeds(raw)).toEqual([
			{ name: "Work", url: "https://calendar.google.com/a/basic.ics" },
			{ name: "Team Stuff", url: "https://calendar.google.com/b/basic.ics" },
		]);
	});

	it("throws on missing pipe or non-https URL", () => {
		expect(() => parseGoogleIcsFeeds("https://only-url.ics")).toThrow(/Invalid/);
		expect(() => parseGoogleIcsFeeds("Work|http://insecure.ics")).toThrow(/https/);
	});
});
