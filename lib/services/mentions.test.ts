import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { syncMentions } from "@/lib/services/mentions";

// Minimal chainable stub covering the call shapes syncMentions uses:
// .from("people").select().in() (validation), .from("mentions").select().eq()
// (existing rows), .from("mentions").delete().in() (stale), and
// .from("mentions").insert() (missing). Records every call so tests can
// assert on wiring without a real database.
function stubSupabase(opts: {
	validPeopleIds: string[];
	existing: Array<{ id: string; person_id: string }>;
}) {
	const calls: Array<{ op: string; table: string; payload: unknown }> = [];

	const sb = {
		from: vi.fn((table: string) => ({
			select: vi.fn((cols: string) => {
				if (table === "people") {
					return {
						in: vi.fn(async (_col: string, ids: string[]) => {
							calls.push({ op: "select-people-in", table, payload: ids });
							return {
								data: opts.validPeopleIds.filter((id) => ids.includes(id)).map((id) => ({ id })),
								error: null,
							};
						}),
					};
				}
				// mentions select(...).eq(column, sourceId)
				return {
					eq: vi.fn(async (col: string, value: unknown) => {
						calls.push({ op: "select-mentions-eq", table, payload: { col, value, cols } });
						return { data: opts.existing, error: null };
					}),
				};
			}),
			delete: vi.fn(() => ({
				in: vi.fn(async (_col: string, ids: string[]) => {
					calls.push({ op: "delete-in", table, payload: ids });
					return { data: null, error: null };
				}),
			})),
			insert: vi.fn(async (rows: unknown) => {
				calls.push({ op: "insert", table, payload: rows });
				return { data: null, error: null };
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, calls };
}

describe("syncMentions", () => {
	it("inserts newly matched people not already mentioned", async () => {
		const { sb, calls } = stubSupabase({ validPeopleIds: ["p1"], existing: [] });

		await syncMentions(sb, { type: "task", id: "task-1" }, [{ personId: "p1", name: "Ana" }]);

		expect(calls).toContainEqual({
			op: "insert",
			table: "mentions",
			payload: [{ person_id: "p1", task_id: "task-1", source_type: "task", matched_name: "Ana" }],
		});
	});

	it("deletes stale mentions no longer present in the matches", async () => {
		const { sb, calls } = stubSupabase({
			validPeopleIds: [],
			existing: [{ id: "mention-1", person_id: "p1" }],
		});

		await syncMentions(sb, { type: "note", id: "note-1" }, []);

		expect(calls).toContainEqual({ op: "delete-in", table: "mentions", payload: ["mention-1"] });
	});

	it("leaves an already-mentioned person alone (no insert, no delete)", async () => {
		const { sb, calls } = stubSupabase({
			validPeopleIds: ["p1"],
			existing: [{ id: "mention-1", person_id: "p1" }],
		});

		await syncMentions(sb, { type: "task", id: "task-1" }, [{ personId: "p1", name: "Ana" }]);

		expect(calls.some((c) => c.op === "insert")).toBe(false);
		expect(calls.some((c) => c.op === "delete-in")).toBe(false);
	});

	it("drops a matched person id that doesn't exist in people (never inserts an invalid FK)", async () => {
		const { sb, calls } = stubSupabase({ validPeopleIds: [], existing: [] });

		await syncMentions(sb, { type: "task", id: "task-1" }, [{ personId: "ghost", name: "Ghost" }]);

		expect(calls.some((c) => c.op === "insert")).toBe(false);
	});

	it("does nothing when there are no matches and no existing mentions", async () => {
		const { sb, calls } = stubSupabase({ validPeopleIds: [], existing: [] });

		await syncMentions(sb, { type: "task", id: "task-1" }, []);

		expect(calls.some((c) => c.op === "insert")).toBe(false);
		expect(calls.some((c) => c.op === "delete-in")).toBe(false);
	});
});
