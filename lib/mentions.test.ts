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
	spliceMention,
} from "@/lib/mentions";

const RENAN_ALVES: MentionCandidate = { id: "person-renan-alves", name: "Renan Alves" };
const RENAN_SHORT: MentionCandidate = { id: "person-renan", name: "Renan" };
const ANA: MentionCandidate = { id: "person-ana", name: "Ana" };

describe("extractMentions", () => {
	it.each([
		["matches a single-word name", [ANA], "call @Ana tomorrow", ANA.id, "Ana", 5, 9],
		[
			"prefers the longest join over a shorter name that's also a prefix",
			[RENAN_ALVES, RENAN_SHORT],
			"ping @Renan Alves please",
			RENAN_ALVES.id,
			"Renan Alves",
			5,
			17,
		],
		[
			"falls back to the shorter join when the longer one misses",
			[RENAN_ALVES, RENAN_SHORT],
			"ping @Renan today",
			RENAN_SHORT.id,
			"Renan",
			5,
			11,
		],
		["strips a trailing comma before lookup", [ANA], "cc @Ana, please review", ANA.id, "Ana", 3, 7],
		["strips a closing paren before lookup", [ANA], "(cc @Ana)", ANA.id, "Ana", 4, 8],
		[
			"matches case- and diacritic-insensitively",
			[RENAN_ALVES],
			"oi @renan alves, tudo bem?",
			RENAN_ALVES.id,
			"renan alves",
			3,
			15,
		],
	])("%s", (_name, people, text, personId, name, start, end) => {
		expect(extractMentions(text, buildMentionIndex(people))).toEqual([
			{ personId, name, start, end },
		]);
	});

	it.each([
		[
			"does not match an email address",
			[{ id: "person-alves", name: "alves" }],
			"reach me at renan@alves.id",
		],
		["ignores an @ inside inline backticks", [ANA], "run `git @Ana` in the shell"],
		[
			"ignores an @ inside a fenced code block",
			[ANA],
			["before", "```", "const x = 1; // @Ana", "```", "after"].join("\n"),
		],
		[
			"resolves an ambiguous normalized name to nothing",
			[
				{ id: "person-1", name: "Ana" },
				{ id: "person-2", name: "ana" },
			],
			"cc @Ana please",
		],
		["returns no matches for an empty people list", [], "cc @Ana please"],
		["does not let a name span a newline", [RENAN_ALVES], "@Renan\nAlves"],
	])("%s", (_name, people, text) => {
		expect(extractMentions(text, buildMentionIndex(people))).toEqual([]);
	});

	it("dedupes repeated mentions but reports every occurrence in first-appearance order", () => {
		const index = buildMentionIndex([ANA, RENAN_SHORT]);
		const matches = extractMentions("@Ana and @Renan, then @Ana again", index);
		expect(matches.map((m) => m.personId)).toEqual([ANA.id, RENAN_SHORT.id, ANA.id]);
		expect(matches[0]?.start).toBe(0);
		expect(matches[2]?.start).toBeGreaterThan(matches[1]?.start ?? 0);
	});

	it("matches across multiple lines", () => {
		const index = buildMentionIndex([ANA, RENAN_SHORT]);
		const matches = extractMentions("line one @Ana\nline two @Renan", index);
		expect(matches.map((m) => m.personId)).toEqual([ANA.id, RENAN_SHORT.id]);
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
	it.each([
		["stays open with the caret mid-word", "hi @Ren", 7, { query: "Ren", start: 3 }],
		[
			"stays open with the caret right after a space",
			"hi @Renan Al",
			12,
			{ query: "Renan Al", start: 3 },
		],
		["returns null when there is no @", "hi Renan", 8, null],
		[
			"closes the query at a newline — an @ on an earlier line doesn't count",
			"@Renan\nhi there",
			15,
			null,
		],
	])("%s", (_name, value, caret, expected) => {
		expect(activeMentionQuery(value, caret)).toEqual(expected);
	});
});

// ─── spliceMention ─────────────────────────────────────────────────────
//
// Both of these are regressions caught in the browser, not by a unit test:
// the accepted suggestion dropped the "@" (so extractMentions then matched
// nothing at all), and the dropdown computed against a stale value.

describe("spliceMention", () => {
	it("keeps the @ so the result is still an extractable mention", () => {
		const out = spliceMention("ligar @Th", 6, 9, "Thais");
		expect(out.value).toBe("ligar @Thais ");
		expect(out.caret).toBe(out.value.length);
	});

	it("round-trips through extractMentions", () => {
		const index = buildMentionIndex([{ id: "p1", name: "Thais" }]);
		const out = spliceMention("ligar @Th", 6, 9, "Thais");
		expect(extractMentions(out.value, index).map((m) => m.personId)).toEqual(["p1"]);
	});

	it("preserves text after the caret", () => {
		const out = spliceMention("ligar @Th amanha", 6, 9, "Thais");
		expect(out.value).toBe("ligar @Thais  amanha");
	});

	it("handles a multi-word name", () => {
		const index = buildMentionIndex([{ id: "p2", name: "Renan Alves" }]);
		const out = spliceMention("@Re", 0, 3, "Renan Alves");
		expect(out.value).toBe("@Renan Alves ");
		expect(extractMentions(out.value, index).map((m) => m.personId)).toEqual(["p2"]);
	});
});
