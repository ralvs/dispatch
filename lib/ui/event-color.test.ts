import { describe, expect, it } from "vitest";
import { colorSlugVar } from "@/lib/schemas/color";
import { eventColor, eventColorSlug } from "@/lib/ui/event-color";

const engine = { name: "Engine", color: "engine" as string | null };

describe("eventColorSlug", () => {
	it("uses the matching domain's live colour, not a hash of the name", () => {
		expect(eventColorSlug("Engine", [engine])).toBe("engine");
		expect(eventColorSlug("engine", [{ name: "Engine", color: "burgundy" }])).toBe("burgundy");
	});

	it("ignores a domain with no colour and hashes the calendar name instead", () => {
		const hashed = eventColorSlug("Engine");
		expect(eventColorSlug("Engine", [{ name: "Engine", color: null }])).toBe(hashed);
		expect(hashed).toBeTruthy();
	});

	it("hashes an unmatched calendar so it still gets a stable slot", () => {
		const a = eventColorSlug("Thais", [engine]);
		const b = eventColorSlug("Thais", [engine]);
		expect(a).toBe(b);
		expect(a).not.toBe("engine");
	});

	it("returns null when there is no calendar name", () => {
		expect(eventColorSlug(null, [engine])).toBeNull();
		expect(eventColorSlug(undefined)).toBeNull();
	});
});

describe("eventColor", () => {
	it("resolves a matched domain through the theme token", () => {
		expect(eventColor("Engine", [{ name: "Engine", color: "burgundy" }])).toBe(
			colorSlugVar("burgundy"),
		);
	});

	it("falls back to ink when the calendar name is missing", () => {
		expect(eventColor(null)).toBe("var(--ink-3)");
	});
});
