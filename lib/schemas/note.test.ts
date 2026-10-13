import { describe, expect, it } from "vitest";
import { SaveNoteSchema } from "./note";

describe("SaveNoteSchema", () => {
	it.each([
		["", null],
		["   \t\n", null],
		[null, null],
		["Real title", "Real title"],
		["  padded  ", "  padded  "],
	])("decodes title %j to %j", (title, expected) => {
		expect(SaveNoteSchema.parse({ title, body: "b" })).toEqual({ title: expected, body: "b" });
	});

	it("keeps an empty body", () => {
		expect(SaveNoteSchema.parse({ title: null, body: "" }).body).toBe("");
	});
});
