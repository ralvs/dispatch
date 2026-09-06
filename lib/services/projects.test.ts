import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { completeProject, createProject, taskProgress } from "@/lib/services/projects";

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
