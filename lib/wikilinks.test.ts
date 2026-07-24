import { describe, expect, it } from "vitest";
import { extractWikilinkIds, sanitizeLabel, serializeWikilink, WIKILINK_RE } from "@/lib/wikilinks";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("extractWikilinkIds", () => {
	it("extracts a single id", () => {
		expect(extractWikilinkIds(`See [[${ID_A}|My Note]] for more.`)).toEqual([ID_A]);
	});

	it("extracts multiple ids in order of first appearance", () => {
		expect(extractWikilinkIds(`[[${ID_A}|A]] then [[${ID_B}|B]]`)).toEqual([ID_A, ID_B]);
	});

	it("dedups repeated links, keeping first-appearance order", () => {
		expect(extractWikilinkIds(`[[${ID_B}|B]] [[${ID_A}|A]] [[${ID_B}|B again]]`)).toEqual([
			ID_B,
			ID_A,
		]);
	});

	it("ignores non-uuid targets", () => {
		expect(extractWikilinkIds("[[not-a-uuid|x]]")).toEqual([]);
	});

	it("ignores plain markdown links", () => {
		expect(extractWikilinkIds("[text](https://example.com)")).toEqual([]);
	});

	it("ignores empty brackets", () => {
		expect(extractWikilinkIds("[[]]")).toEqual([]);
	});

	it("handles labels with spaces and unicode", () => {
		expect(extractWikilinkIds(`[[${ID_A}|Café notes — 会議]]`)).toEqual([ID_A]);
	});

	it("returns no matches for empty input", () => {
		expect(extractWikilinkIds("")).toEqual([]);
	});
});

describe("sanitizeLabel", () => {
	it("passes through a clean label", () => {
		expect(sanitizeLabel("My Note")).toBe("My Note");
	});

	it("strips pipes and brackets", () => {
		expect(sanitizeLabel("a|b[c]d")).toBe("abcd");
	});

	it("collapses internal whitespace and newlines", () => {
		expect(sanitizeLabel("a\n\nb   c")).toBe("a b c");
	});

	it("trims leading/trailing whitespace", () => {
		expect(sanitizeLabel("  spaced  ")).toBe("spaced");
	});

	it("falls back to Untitled when the result is empty", () => {
		expect(sanitizeLabel("")).toBe("Untitled");
		expect(sanitizeLabel("   ")).toBe("Untitled");
		expect(sanitizeLabel("|[]")).toBe("Untitled");
	});
});

describe("serializeWikilink", () => {
	it("produces [[id|label]]", () => {
		expect(serializeWikilink(ID_A, "My Note")).toBe(`[[${ID_A}|My Note]]`);
	});

	it("sanitizes the label so it can't break out with ]]", () => {
		expect(serializeWikilink(ID_A, "a]]b")).toBe(`[[${ID_A}|ab]]`);
	});

	it("round-trips through extractWikilinkIds", () => {
		const md = serializeWikilink(ID_A, "Round Trip");
		expect(extractWikilinkIds(md)).toEqual([ID_A]);
	});

	it("round-trips a label containing a pipe by sanitizing first", () => {
		const md = serializeWikilink(ID_B, "a|b");
		expect(md).toBe(`[[${ID_B}|ab]]`);
		expect(extractWikilinkIds(md)).toEqual([ID_B]);
	});
});

describe("WIKILINK_RE", () => {
	it("is a global regex so repeated use requires fresh matchAll calls", () => {
		expect(WIKILINK_RE.global).toBe(true);
	});
});
