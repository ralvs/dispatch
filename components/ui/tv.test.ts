import { describe, expect, it } from "vitest";
import { tv } from "./tv";

describe("tv", () => {
	it("keeps a theme font size next to a text colour", () => {
		const label = tv({ base: "text-eyebrow text-ink-3" });
		expect(label()).toBe("text-eyebrow text-ink-3");
	});

	it("still lets a later font size win over an earlier one", () => {
		const label = tv({ base: "text-meta", variants: { big: { true: "text-eyebrow" } } });
		expect(label({ big: true })).toBe("text-eyebrow");
	});
});
