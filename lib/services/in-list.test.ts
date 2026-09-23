import { describe, expect, it } from "vitest";
import { inListLiteral } from "@/lib/services/in-list";

describe("inListLiteral", () => {
	it("quotes every value", () => {
		expect(inListLiteral(["a", "b,c"])).toBe('("a","b,c")');
	});

	it("escapes a backslash before a quote, so neither can end the value early", () => {
		expect(inListLiteral(['say "hi"', "ends\\"])).toBe('("say \\"hi\\"","ends\\\\")');
	});
});
