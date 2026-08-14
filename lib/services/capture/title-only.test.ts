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
		expect(titleOnlyCreate(form({ title: "x", priority: "4" }))).toBe(true);
	});

	it("is false once any other field has been touched", () => {
		expect(titleOnlyCreate(form({ title: "x", due_date: "2026-07-15" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", due_time: "09:00" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", notes: "hello" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", domain_id: "dom-1" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", recurrence_rule: "weekly" }))).toBe(false);
		expect(titleOnlyCreate(form({ title: "x", priority: "1" }))).toBe(false);
	});
});
