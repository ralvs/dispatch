import { describe, expect, it } from "vitest";
import { isBlank, isStaleSubmission } from "@/lib/capture/submission";

describe("isStaleSubmission", () => {
	it("is false when the submitted sequence is still current", () => {
		expect(isStaleSubmission(3, 3)).toBe(false);
	});

	it("is true once the sequence has advanced (newer submit or a close)", () => {
		expect(isStaleSubmission(3, 4)).toBe(true);
		expect(isStaleSubmission(3, 5)).toBe(true);
	});
});

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
