import { describe, expect, it } from "vitest";
import { bestMatch, matchScore } from "@/lib/services/capture/match";

const PROJECTS = [
	{ name: "Apartment move" },
	{ name: "Taxes 2026" },
	{ name: "Dispatch" },
	{ name: "Reviews v2.4 plugin" },
];

describe("matchScore", () => {
	it("scores an exact name 1, ignoring case and accents", () => {
		expect(matchScore("SAÚDE", "saude")).toBe(1);
	});

	it("drops filler words before comparing", () => {
		expect(matchScore("the apartment", "Apartment move")).toBeGreaterThanOrEqual(0.5);
		expect(matchScore("o apartamento", "Apartamento")).toBe(1);
	});
});

describe("bestMatch", () => {
	it("finds the project a short phrase names", () => {
		expect(bestMatch("the apartment", PROJECTS)?.name).toBe("Apartment move");
		expect(bestMatch("taxes", PROJECTS)?.name).toBe("Taxes 2026");
		expect(bestMatch("the Reviews plugin", PROJECTS)?.name).toBe("Reviews v2.4 plugin");
	});

	it("returns null when nothing is close", () => {
		expect(bestMatch("garden", PROJECTS)).toBeNull();
		expect(bestMatch("skip", PROJECTS)).toBeNull();
	});

	it("returns null on a filler-only phrase", () => {
		expect(bestMatch("the", PROJECTS)).toBeNull();
	});

	// The reference takes the first row on a tie, which files the task under
	// whichever project happened to be listed first.
	it("returns null when two candidates tie", () => {
		const two = [{ name: "Kitchen paint" }, { name: "Kitchen tiles" }];
		expect(bestMatch("kitchen", two)).toBeNull();
	});
});
