import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	completeProject,
	countTasksByProject,
	createProject,
	taskProgress,
} from "@/lib/services/projects";

// Stub covering .from().insert().select().single() and .from().update().eq().
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	const updates: Array<Record<string, unknown>> = [];

	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "row-1", ...row }, error: null })),
					})),
				};
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updates.push(patch);
				return {
					eq: vi.fn(async () => ({ data: null, error: null })),
				};
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, updates };
}

describe("createProject", () => {
	it("stores the given fields", async () => {
		const { sb, inserts } = stubSupabase();

		const project = await createProject(sb, { name: "Rebuild deck", kind: "project" });

		expect(project.id).toBe("row-1");
		expect(inserts[0]).toMatchObject({ name: "Rebuild deck", kind: "project" });
	});
});

describe("completeProject", () => {
	it("sets status=done and stamps completed_at", async () => {
		const { sb, updates } = stubSupabase();

		await completeProject(sb, "project-1");

		expect(updates[0]).toMatchObject({ status: "done" });
		expect(typeof updates[0].completed_at).toBe("string");
	});
});

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

describe("countTasksByProject", () => {
	it("asks the database for non-wants only, and folds by project", async () => {
		const filters: Array<[string, unknown]> = [];
		const rows = [
			{ project_id: "p1", status: "open" },
			{ project_id: "p1", status: "done" },
			{ project_id: "p2", status: "open" },
			{ project_id: null, status: "open" },
		];
		const query = {
			not: () => query,
			eq: (column: string, value: unknown) => {
				filters.push([column, value]);
				return Promise.resolve({ data: rows, error: null });
			},
		};
		const sb = { from: () => ({ select: () => query }) } as unknown as SupabaseClient;

		const counts = await countTasksByProject(sb);

		// A parked want must not inflate "open" or drag progress down.
		expect(filters).toContainEqual(["someday", false]);
		expect(counts.p1).toEqual({ done: 1, open: 1 });
		expect(counts.p2).toEqual({ done: 0, open: 1 });
		// A task with no project is not a project's task.
		expect(Object.keys(counts)).toEqual(["p1", "p2"]);
	});
});
