import { describe, expect, it } from "vitest";
import {
	escapeLike,
	haystackHas,
	noteField,
	sanitizeFindQuery,
	snippetAround,
	taskField,
	taskScore,
} from "./match";

describe("escapeLike", () => {
	it("escapes ilike wildcards", () => {
		expect(escapeLike("100%_off")).toBe("100\\%\\_off");
	});
});

describe("sanitizeFindQuery", () => {
	it("strips or() separators", () => {
		expect(sanitizeFindQuery("foo, bar(baz)")).toBe("foo bar baz");
	});
});

describe("snippetAround", () => {
	it("returns null when the query is not in the haystack", () => {
		expect(snippetAround("hello world", "dentista")).toBeNull();
	});

	it("keeps the match and a little context", () => {
		const text = "Guardar o recibo do dentista particular amanhã.";
		expect(snippetAround(text, "dentista")).toContain("dentista");
	});

	it("strips markdown punctuation", () => {
		expect(snippetAround("**dentista** na **saúde**", "dentista")).not.toContain("*");
	});
});

describe("ranking", () => {
	it("scores a title hit above a notes hit", () => {
		const title = taskScore({
			title: "Marcar dentista",
			notes: null,
			status: "open",
			query: "dentista",
		});
		const notes = taskScore({
			title: "Convênio",
			notes: "retorno do dentista",
			status: "open",
			query: "dentista",
		});
		expect(title).toBeGreaterThan(notes);
	});

	it("prefers open tasks over done at the same field", () => {
		const open = taskScore({ title: "x", notes: "dentista", status: "open", query: "dentista" });
		const done = taskScore({ title: "x", notes: "dentista", status: "done", query: "dentista" });
		expect(open).toBeGreaterThan(done);
	});

	it("names the title field when both hit", () => {
		expect(taskField("dentista", "dentista")).toBe("title");
		expect(noteField("Plano", "dentista")).toBe("body");
	});

	it("does not treat a missing notes column as a hit", () => {
		expect(haystackHas(null, "x")).toBe(false);
	});
});
