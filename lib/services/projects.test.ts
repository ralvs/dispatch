import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	completeProject,
	createMilestone,
	createProject,
	milestoneProgress,
	toggleMilestone,
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

describe("createMilestone", () => {
	it("links the milestone to the project", async () => {
		const { sb, inserts } = stubSupabase();

		await createMilestone(sb, "project-1", { title: "Ship v1", weight: 2 });

		expect(inserts[0]).toMatchObject({
			project_id: "project-1",
			title: "Ship v1",
			weight: 2,
		});
	});
});

describe("toggleMilestone", () => {
	it("marking done sets status=done and stamps completed_at", async () => {
		const { sb, updates } = stubSupabase();

		await toggleMilestone(sb, "milestone-1", true);

		expect(updates[0].status).toBe("done");
		expect(typeof updates[0].completed_at).toBe("string");
	});

	it("marking open clears completed_at", async () => {
		const { sb, updates } = stubSupabase();

		await toggleMilestone(sb, "milestone-1", false);

		expect(updates[0]).toMatchObject({ status: "open", completed_at: null });
	});
});

describe("milestoneProgress", () => {
	it("is 0 for an empty list", () => {
		expect(milestoneProgress([])).toBe(0);
	});

	it("is the done weight over total weight", () => {
		const progress = milestoneProgress([
			{ status: "done", weight: 1 },
			{ status: "open", weight: 3 },
			{ status: "done", weight: 2 },
		]);

		expect(progress).toBeCloseTo(3 / 6);
	});
});
