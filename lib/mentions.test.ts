import { describe, expect, it } from "vitest";
import {
	activeMentionQuery,
	buildMentionIndex,
	extractMentionMatches,
	extractMentionPersonIds,
	extractMentions,
	type MentionCandidate,
	normalizeName,
	serializeMention,
} from "@/lib/mentions";

const RENAN_ALVES: MentionCandidate = { id: "person-renan-alves", name: "Renan Alves" };
const RENAN_SHORT: MentionCandidate = { id: "person-renan", name: "Renan" };
const ANA: MentionCandidate = { id: "person-ana", name: "Ana" };

describe("extractMentions", () => {
	it("matches a single-word name", () => {
		const index = buildMentionIndex([ANA]);
		const matches = extractMentions("call @Ana tomorrow", index);
		expect(matches).toEqual([{ personId: ANA.id, name: "Ana", start: 5, end: 9 }]);
	});

	it("prefers the longest join over a shorter name that's also a prefix", () => {
		const index = buildMentionIndex([RENAN_ALVES, RENAN_SHORT]);
		const matches = extractMentions("ping @Renan Alves please", index);
		expect(matches).toEqual([{ personId: RENAN_ALVES.id, name: "Renan Alves", start: 5, end: 17 }]);
	});

	it("falls back to the shorter join when the longer one misses", () => {
		const index = buildMentionIndex([RENAN_ALVES, RENAN_SHORT]);
		const matches = extractMentions("ping @Renan today", index);
		expect(matches).toEqual([{ personId: RENAN_SHORT.id, name: "Renan", start: 5, end: 11 }]);
	});

	it("strips trailing punctuation before lookup", () => {
		const index = buildMentionIndex([ANA]);
		expect(extractMentions("cc @Ana, please review", index)).toEqual([
			{ personId: ANA.id, name: "Ana", start: 3, end: 7 },
		]);
		expect(extractMentions("(cc @Ana)", index)).toEqual([
			{ personId: ANA.id, name: "Ana", start: 4, end: 8 },
		]);
	});

	it("matches case- and diacritic-insensitively", () => {
		const index = buildMentionIndex([RENAN_ALVES]);
		const matches = extractMentions("oi @renan alves, tudo bem?", index);
		expect(matches).toEqual([{ personId: RENAN_ALVES.id, name: "renan alves", start: 3, end: 15 }]);
	});

	it("does not match an email address", () => {
		const index = buildMentionIndex([{ id: "person-alves", name: "alves" }]);
		expect(extractMentions("reach me at renan@alves.id", index)).toEqual([]);
	});

	it("ignores an @ inside inline backticks", () => {
		const index = buildMentionIndex([ANA]);
		expect(extractMentions("run `git @Ana` in the shell", index)).toEqual([]);
	});

	it("ignores an @ inside a fenced code block", () => {
		const index = buildMentionIndex([ANA]);
		const text = ["before", "```", "const x = 1; // @Ana", "```", "after"].join("\n");
		expect(extractMentions(text, index)).toEqual([]);
	});

	it("resolves an ambiguous normalized name to nothing", () => {
		const index = buildMentionIndex([
			{ id: "person-1", name: "Ana" },
			{ id: "person-2", name: "ana" },
		]);
		expect(extractMentions("cc @Ana please", index)).toEqual([]);
	});

	it("dedupes repeated mentions but reports every occurrence in first-appearance order", () => {
		const index = buildMentionIndex([ANA, RENAN_SHORT]);
		const matches = extractMentions("@Ana and @Renan, then @Ana again", index);
		expect(matches.map((m) => m.personId)).toEqual([ANA.id, RENAN_SHORT.id, ANA.id]);
		expect(matches[0]?.start).toBe(0);
		expect(matches[2]?.start).toBeGreaterThan(matches[1]?.start ?? 0);
	});

	it("returns no matches for an empty people list", () => {
		const index = buildMentionIndex([]);
		expect(extractMentions("cc @Ana please", index)).toEqual([]);
	});

	it("matches across multiple lines", () => {
		const index = buildMentionIndex([ANA, RENAN_SHORT]);
		const matches = extractMentions("line one @Ana\nline two @Renan", index);
		expect(matches.map((m) => m.personId)).toEqual([ANA.id, RENAN_SHORT.id]);
	});

	it("does not let a name span a newline", () => {
		const index = buildMentionIndex([RENAN_ALVES]);
		const matches = extractMentions("@Renan\nAlves", index);
		expect(matches).toEqual([]);
	});
});

describe("normalizeName", () => {
	it("lowercases and strips diacritics", () => {
		expect(normalizeName("Renan Álves")).toBe("renan alves");
	});

	it("trims surrounding whitespace", () => {
		expect(normalizeName("  Ana  ")).toBe("ana");
	});
});

describe("extractMentionPersonIds", () => {
	const ID_A = "11111111-1111-4111-8111-111111111111";
	const ID_B = "22222222-2222-4222-8222-222222222222";

	it("extracts a single mention", () => {
		expect(extractMentionPersonIds(`See @[${ID_A}|Renan Alves] for more.`)).toEqual([ID_A]);
	});

	it("dedupes repeated mentions, keeping first-appearance order", () => {
		expect(extractMentionPersonIds(`@[${ID_B}|B] and @[${ID_A}|A] and @[${ID_B}|B again]`)).toEqual(
			[ID_B, ID_A],
		);
	});

	it("returns no matches for empty input", () => {
		expect(extractMentionPersonIds("")).toEqual([]);
	});
});

describe("extractMentionMatches", () => {
	const ID_A = "11111111-1111-4111-8111-111111111111";
	const ID_B = "22222222-2222-4222-8222-222222222222";

	it("extracts personId + name pairs", () => {
		expect(extractMentionMatches(`See @[${ID_A}|Renan Alves] for more.`)).toEqual([
			{ personId: ID_A, name: "Renan Alves" },
		]);
	});

	it("dedupes repeated mentions of the same id, keeping first appearance's name", () => {
		expect(
			extractMentionMatches(`@[${ID_A}|Renan] and @[${ID_B}|Ana] and @[${ID_A}|Renan Alves]`),
		).toEqual([
			{ personId: ID_A, name: "Renan" },
			{ personId: ID_B, name: "Ana" },
		]);
	});

	it("returns no matches for empty input", () => {
		expect(extractMentionMatches("")).toEqual([]);
	});
});

describe("serializeMention", () => {
	const ID_A = "11111111-1111-4111-8111-111111111111";

	it("produces @[id|name]", () => {
		expect(serializeMention(ID_A, "Renan Alves")).toBe(`@[${ID_A}|Renan Alves]`);
	});

	it("round-trips through extractMentionPersonIds", () => {
		const md = serializeMention(ID_A, "Renan Alves");
		expect(extractMentionPersonIds(md)).toEqual([ID_A]);
	});
});

describe("activeMentionQuery", () => {
	it("stays open with the caret mid-word", () => {
		expect(activeMentionQuery("hi @Ren", 7)).toEqual({ query: "Ren", start: 3 });
	});

	it("stays open with the caret right after a space", () => {
		expect(activeMentionQuery("hi @Renan Al", 12)).toEqual({ query: "Renan Al", start: 3 });
	});

	it("returns null when there is no @", () => {
		expect(activeMentionQuery("hi Renan", 8)).toBeNull();
	});

	it("closes the query at a newline — an @ on an earlier line doesn't count", () => {
		const value = "@Renan\nhi there";
		expect(activeMentionQuery(value, value.length)).toBeNull();
	});
});
