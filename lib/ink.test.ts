import { describe, expect, it } from "vitest";
import { INK_SLUGS, inkVar, isInkSlug } from "@/lib/ink";

describe("ink slugs", () => {
	it("includes the nine domain slots plus accent and error", () => {
		expect(INK_SLUGS).toContain("travel");
		expect(INK_SLUGS).toContain("accent");
		expect(INK_SLUGS).toContain("error");
		expect(INK_SLUGS).toHaveLength(11);
	});

	it("rejects unknown slugs", () => {
		expect(isInkSlug("health")).toBe(true);
		expect(isInkSlug("#ff0000")).toBe(false);
		expect(isInkSlug("ink")).toBe(false);
	});

	it("resolves to theme tokens, never a hex", () => {
		expect(inkVar("accent")).toBe("var(--accent)");
		expect(inkVar("error")).toBe("var(--error)");
		expect(inkVar("health")).toBe("var(--domain-health)");
	});
});
