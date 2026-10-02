import { describe, expect, it } from "vitest";
import { isBlank } from "@/lib/capture/submission";

describe("isBlank", () => {
	it("treats empty and whitespace-only drafts as blank", () => {
		expect(isBlank("")).toBe(true);
		expect(isBlank("   ")).toBe(true);
		expect(isBlank("\n\t ")).toBe(true);
	});

	it("treats padded content as non-blank (verbatim whitespace is preserved)", () => {
		expect(isBlank("  hello  ")).toBe(false);
		expect(isBlank("x")).toBe(false);
	});
});
