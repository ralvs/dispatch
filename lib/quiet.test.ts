import { describe, expect, it } from "vitest";
import { isQuiet, notQuietFilter, quietProjectIdsOf } from "@/lib/quiet";

describe("isQuiet", () => {
	const quiet = new Set(["paused-project"]);

	it("is true for an undated task in a project that is not active", () => {
		expect(isQuiet({ due_date: null, project_id: "paused-project" }, quiet)).toBe(true);
	});

	it("is false for a dated task, even in a quiet project — a due date always wins", () => {
		expect(isQuiet({ due_date: "2026-07-15", project_id: "paused-project" }, quiet)).toBe(false);
	});

	it("is false for a task with no project at all", () => {
		expect(isQuiet({ due_date: null, project_id: null }, quiet)).toBe(false);
	});

	it("is false for an undated task in an active project", () => {
		expect(isQuiet({ due_date: null, project_id: "active-project" }, quiet)).toBe(false);
	});

	it("is false for everything when no project is quiet", () => {
		expect(isQuiet({ due_date: null, project_id: "paused-project" }, new Set())).toBe(false);
	});
});

describe("quietProjectIdsOf", () => {
	it("names every project that is not active", () => {
		const projects = ["active", "paused", "done", "archived"].map((status) => ({
			id: status,
			status,
		}));
		expect(quietProjectIdsOf(projects)).toEqual(["paused", "done", "archived"]);
	});
});

describe("notQuietFilter", () => {
	it("is null when nothing is quiet", () => {
		expect(notQuietFilter(new Set())).toBeNull();
	});

	it("keeps a dated task, a loose task, or one outside the quiet projects", () => {
		expect(notQuietFilter(new Set(["p1", "p2"]))).toBe(
			"due_date.not.is.null,project_id.is.null,project_id.not.in.(p1,p2)",
		);
	});
});
