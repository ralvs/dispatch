import { describe, expect, it } from "vitest";
import { taskProgress } from "@/lib/services/projects";

// taskProgress is pure and stays a unit test. Every database read and write
// runs against the local database in projects.int.test.ts (#18).

describe("taskProgress", () => {
	it("is 0 for a project with no tasks", () => {
		expect(taskProgress({ done: 0, open: 0 })).toBe(0);
	});

	it("is done over done + open", () => {
		expect(taskProgress({ done: 3, open: 1 })).toBeCloseTo(0.75);
	});

	it("is 1 when everything is finished", () => {
		expect(taskProgress({ done: 2, open: 0 })).toBe(1);
	});
});
