import { describe, expect, it } from "vitest";
import { titleOnlyCreate } from "@/lib/services/capture/title-only";

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe("titleOnlyCreate", () => {
	it("is true when only a title is set (or every other field is still default)", () => {
		expect(titleOnlyCreate(form({ title: "pay rent every monday 9am" }))).toBe(true);
		expect(titleOnlyCreate(form({ title: "x", priority: "3" }))).toBe(true);
	});

	it("stays true when a domain is picked, because picking one is mandatory", () => {
		// A set domain used to mean "the operator reached for the filing row".
		// It cannot mean that any more — the field has no empty answer — so
		// reading it that way would retire the sentence parser outright.
		expect(titleOnlyCreate(form({ title: "pay rent every monday", domain_id: "dom-1" }))).toBe(
			true,
		);
	});

	it("is false once any other field has been touched", () => {
		expect(titleOnlyCreate(form({ title: "x", due_date: "2026-07-15" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", due_time: "09:00" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", notes: "hello" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", project_id: "proj-1" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", recurrence_rule: "weekly" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", priority: "1" }))).toBe(false);
	});
});
