import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { completeTask } from "@/lib/services/tasks";

const TODAY = "2026-07-15";

// Minimal chainable stub covering exactly the two call shapes completeTask
// uses: .from().select().eq().maybeSingle() (via getTask) and
// .from().update().eq() (the mutation). Records every update() patch so
// tests can assert on wiring without a real database.
function stubSupabase(row: Record<string, unknown>) {
	const updatePatches: Array<Record<string, unknown>> = [];

	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => ({ data: row, error: null })),
				})),
			})),
			update: vi.fn((patch: Record<string, unknown>) => {
				updatePatches.push(patch);
				return {
					eq: vi.fn(async () => ({ data: null, error: null })),
				};
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, updatePatches };
}

describe("completeTask", () => {
	it("rolls due_date forward and touches nothing else for a recurring task", async () => {
		const { sb, updatePatches } = stubSupabase({
			id: "task-1",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
		});

		const result = await completeTask(sb, "task-1", TODAY);

		expect(result).toEqual({ rolled: true });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0]).toHaveProperty("due_date");
		expect(updatePatches[0]).not.toHaveProperty("status");
		expect(updatePatches[0]).not.toHaveProperty("completed_at");
	});

	it("sets status done and completed_at for a non-recurring task", async () => {
		const { sb, updatePatches } = stubSupabase({
			id: "task-2",
			recurrence_rule: null,
			due_date: "2026-07-10",
		});

		const result = await completeTask(sb, "task-2", TODAY);

		expect(result).toEqual({ rolled: false });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0]).toMatchObject({ status: "done" });
		expect(updatePatches[0].completed_at).toEqual(expect.any(String));
	});
});
