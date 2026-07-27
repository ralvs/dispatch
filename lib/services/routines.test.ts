import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { deleteRoutine, listCompletionsForRoutines, setCompletion } from "@/lib/services/routines";

// Stub covering .from().upsert(), .from().delete().eq() (routines), and
// .from().delete().eq().eq() (routine_completions pair delete).
function stubSupabase() {
	const upserts: Array<{ row: Record<string, unknown>; opts: Record<string, unknown> }> = [];
	const deletedTables: string[] = [];

	const sb = {
		from: vi.fn((table: string) => ({
			upsert: vi.fn((row: Record<string, unknown>, opts: Record<string, unknown>) => {
				upserts.push({ row, opts });
				return Promise.resolve({ data: null, error: null });
			}),
			delete: vi.fn(() => {
				// routine_completions deletes chain two .eq() calls (routine_id +
				// completed_date); routines deletes a single .eq("id", ...).
				if (table === "routine_completions") {
					return {
						eq: vi.fn(() => ({
							eq: vi.fn(async () => {
								deletedTables.push(table);
								return { data: null, error: null };
							}),
						})),
					};
				}
				return {
					eq: vi.fn(async () => {
						deletedTables.push(table);
						return { data: null, error: null };
					}),
				};
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, upserts, deletedTables };
}

describe("setCompletion", () => {
	it("upserts with ignoreDuplicates so a double-tap is a no-op", async () => {
		const { sb, upserts } = stubSupabase();

		await setCompletion(sb, "routine-1", "2026-07-16", true);

		expect(upserts).toHaveLength(1);
		expect(upserts[0].row).toEqual({ routine_id: "routine-1", completed_date: "2026-07-16" });
		expect(upserts[0].opts).toMatchObject({
			onConflict: "routine_id,completed_date",
			ignoreDuplicates: true,
		});
	});

	it("deletes the (routine_id, completed_date) pair when untoggling", async () => {
		const { sb, deletedTables } = stubSupabase();

		await setCompletion(sb, "routine-1", "2026-07-16", false);

		expect(deletedTables).toContain("routine_completions");
	});
});

describe("deleteRoutine", () => {
	it("deletes the routine row; completions cascade via FK", async () => {
		const { sb, deletedTables } = stubSupabase();

		await deleteRoutine(sb, "routine-1");

		expect(deletedTables).toContain("routines");
	});
});

// Stub covering .from().select().in().gte().order() — the single batched
// query listCompletionsForRoutines runs in place of one query per routine.
function stubBatchedSelect(rows: Record<string, unknown>[]) {
	const inArgs: unknown[] = [];

	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				in: vi.fn((_col: string, ids: string[]) => {
					inArgs.push(ids);
					return {
						gte: vi.fn(() => ({
							order: vi.fn(async () => ({ data: rows, error: null })),
						})),
					};
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inArgs };
}

describe("listCompletionsForRoutines", () => {
	it("groups completions by routine_id from a single query", async () => {
		const { sb, inArgs } = stubBatchedSelect([
			{ id: "c1", routine_id: "routine-1", completed_date: "2026-07-10", created_at: "" },
			{ id: "c2", routine_id: "routine-2", completed_date: "2026-07-11", created_at: "" },
			{ id: "c3", routine_id: "routine-1", completed_date: "2026-07-12", created_at: "" },
		]);

		const byRoutine = await listCompletionsForRoutines(
			sb,
			["routine-1", "routine-2"],
			"2026-06-01",
		);

		expect(inArgs).toEqual([["routine-1", "routine-2"]]);
		expect(byRoutine["routine-1"]).toHaveLength(2);
		expect(byRoutine["routine-2"]).toHaveLength(1);
		expect(byRoutine["routine-3"]).toBeUndefined();
	});

	it("returns an empty object without querying when there are no routines", async () => {
		const { sb, inArgs } = stubBatchedSelect([]);

		const byRoutine = await listCompletionsForRoutines(sb, [], "2026-06-01");

		expect(byRoutine).toEqual({});
		expect(inArgs).toHaveLength(0);
	});
});
