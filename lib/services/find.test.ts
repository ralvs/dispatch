import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { find } from "@/lib/services/find";

type StubResult = { data?: unknown; error?: unknown };

function stubSupabase(results: Record<string, StubResult>) {
	const calls: Array<{ table: string; op: string; payload: unknown }> = [];
	const from = vi.fn((table: string) => {
		const res = results[table] ?? { data: [], error: null };
		// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
		const builder: any = {};
		const record = (op: string) => (payload: unknown) => {
			calls.push({ table, op, payload });
			return builder;
		};
		builder.select = () => builder;
		builder.eq = (col: string, value: unknown) => {
			calls.push({ table, op: "eq", payload: { col, value } });
			return builder;
		};
		builder.or = record("or");
		builder.order = record("order");
		builder.limit = record("limit");
		// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
		builder.then = (resolve: (v: StubResult) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(res).then(resolve, reject);
		return builder;
	});
	return { sb: { from } as unknown as SupabaseClient, calls };
}

describe("find", () => {
	it("returns recents when the query is short", async () => {
		const { sb, calls } = stubSupabase({
			tasks: { data: [{ id: "t1", title: "Milk", notes: null, status: "open", created_at: "z" }] },
			notes: {
				data: [{ id: "n1", title: "Plan", body: "x", needs_review: false, created_at: "z" }],
			},
		});
		const result = await find(sb, "d");
		expect(result.recents).toBe(true);
		expect(result.tasks).toHaveLength(1);
		expect(result.notes[0]?.title).toBe("Plan");
		expect(calls.some((c) => c.op === "or")).toBe(false);
		expect(calls).toContainEqual({
			table: "tasks",
			op: "eq",
			payload: { col: "status", value: "open" },
		});
	});

	it("searches title or notes on tasks, and title or body on notes", async () => {
		const { sb, calls } = stubSupabase({
			tasks: {
				data: [
					{
						id: "t1",
						title: "Convênio",
						notes: "retorno do dentista",
						status: "open",
						created_at: "2026-01-02",
					},
				],
			},
			notes: {
				data: [
					{
						id: "n1",
						title: "Plano",
						body: "cobertura do dentista",
						needs_review: false,
						created_at: "2026-01-01",
					},
				],
			},
		});
		const result = await find(sb, "dentista");
		expect(result.recents).toBe(false);
		expect(result.tasks[0]).toMatchObject({ field: "notes", title: "Convênio" });
		expect(result.tasks[0]?.snippet).toContain("dentista");
		expect(result.notes[0]).toMatchObject({ field: "body" });
		expect(calls).toContainEqual({
			table: "tasks",
			op: "or",
			payload: "title.ilike.%dentista%,notes.ilike.%dentista%",
		});
		expect(calls).toContainEqual({
			table: "notes",
			op: "or",
			payload: "title.ilike.%dentista%,body.ilike.%dentista%",
		});
	});

	it("ranks a title hit above a notes hit", async () => {
		const { sb } = stubSupabase({
			tasks: {
				data: [
					{
						id: "notes-hit",
						title: "Convênio",
						notes: "dentista",
						status: "open",
						created_at: "2026-01-02",
					},
					{
						id: "title-hit",
						title: "Marcar dentista",
						notes: null,
						status: "open",
						created_at: "2026-01-01",
					},
				],
			},
			notes: { data: [] },
		});
		const result = await find(sb, "dentista");
		expect(result.tasks.map((t) => t.id)).toEqual(["title-hit", "notes-hit"]);
	});
});
