import { describe, expect, it } from "vitest";
import { guardTitle, isVerbatim } from "@/lib/ai/verbatim";

describe("isVerbatim", () => {
	it("accepts a title that drops the routing prefix and the day word", () => {
		// The parser is SUPPOSED to strip these; the guard only forbids adding.
		expect(isVerbatim("Ask refunds", "home: Ask refunds today")).toBe(true);
		expect(isVerbatim("marcar dentista", "saúde marcar dentista sexta")).toBe(true);
	});

	it("rejects the hallucination this guard exists for", () => {
		// The real capture: "Ask refunds today" stored as "Ask Heff Hounds".
		expect(isVerbatim("Ask Heff Hounds", "home: Ask refunds today")).toBe(false);
	});

	it("rejects a single invented word among correct ones", () => {
		expect(isVerbatim("send the invoice to Maria", "work: send the invoice tomorrow")).toBe(false);
	});

	it("ignores case, accents, and punctuation", () => {
		expect(isVerbatim("MARCAR DENTISTA!", "marcar dentista")).toBe(true);
		expect(isVerbatim("cafe", "tomar café")).toBe(true);
	});

	it("allows inflection of a word that was actually said", () => {
		expect(isVerbatim("ask refund", "ask refunds today")).toBe(true);
		expect(isVerbatim("marcarei", "marcar dentista")).toBe(true);
	});

	it("does not let short words match by shared prefix", () => {
		// "do" must not be accepted because "dog" was said — below INFLECTION_MIN
		// the two languages collide constantly and the guard would go blind.
		expect(isVerbatim("do", "walk the dog")).toBe(false);
	});

	it("treats a wordless title as nothing to judge", () => {
		expect(isVerbatim("🎉", "party tonight")).toBe(true);
	});
});

describe("guardTitle", () => {
	it("passes a verbatim title through untouched", () => {
		expect(guardTitle("Ask refunds", "home: Ask refunds today")).toEqual({
			title: "Ask refunds",
			substituted: false,
		});
	});

	it("falls back to the raw text, trimmed, when words were invented", () => {
		expect(guardTitle("Ask Heff Hounds", "  home: Ask refunds today  ")).toEqual({
			title: "home: Ask refunds today",
			substituted: true,
		});
	});
});
