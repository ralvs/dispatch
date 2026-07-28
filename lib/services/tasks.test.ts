import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	assignDomain,
	completeTask,
	createTask,
	listInboxTasks,
	updateTask,
} from "@/lib/services/tasks";

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

	// A recurring "daily 09:00" task keeps its 09:00 across every roll —
	// getTaskHot doesn't even select due_time, and the update patch below only
	// ever writes due_date, so there is nothing in this path that could touch it.
	it("preserves due_time when rolling a recurring task forward", async () => {
		const { sb, updatePatches } = stubSupabase({
			id: "task-3",
			recurrence_rule: "daily",
			due_date: "2026-07-10",
			due_time: "09:00:00",
		});

		const result = await completeTask(sb, "task-3", TODAY);

		expect(result).toEqual({ rolled: true });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0]).toHaveProperty("due_date");
		expect(updatePatches[0]).not.toHaveProperty("due_time");
	});
});

// ─────────────────────────────────────────────────────────────────────────
// due_time may only be set alongside a due_date (DB check constraint added
// alongside this test). UpdateTaskSchema is `.partial()`, so a patch that
// clears due_date while leaving due_time untouched has to be coerced here,
// not caught by Zod.
// ─────────────────────────────────────────────────────────────────────────

describe("updateTask", () => {
	it("nulls due_time when a patch clears due_date", async () => {
		const { sb, calls } = stubBuilder({ data: null, error: null });

		await updateTask(sb, "task-1", { due_date: null });

		expect(calls).toContainEqual({
			op: "update",
			payload: { due_date: null, due_time: null },
		});
	});

	it("nulls due_time even when the same patch also sets a due_time", async () => {
		const { sb, calls } = stubBuilder({ data: null, error: null });

		await updateTask(sb, "task-1", { due_date: null, due_time: "09:00" });

		expect(calls).toContainEqual({
			op: "update",
			payload: { due_date: null, due_time: null },
		});
	});

	it("leaves due_time untouched when due_date isn't part of the patch", async () => {
		const { sb, calls } = stubBuilder({ data: null, error: null });

		await updateTask(sb, "task-1", { title: "renamed" });

		expect(calls).toContainEqual({ op: "update", payload: { title: "renamed" } });
	});

	it("leaves an explicit due_date alone", async () => {
		const { sb, calls } = stubBuilder({ data: null, error: null });

		await updateTask(sb, "task-1", { due_date: "2026-08-01", due_time: "09:00" });

		expect(calls).toContainEqual({
			op: "update",
			payload: { due_date: "2026-08-01", due_time: "09:00" },
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────
// The inbox queue (docs/adr/0024, docs/adr/0027). Until this file, nothing
// covered the one path every unrouted capture takes.
// ─────────────────────────────────────────────────────────────────────────

// Same chainable/thenable double the other service tests use (cf.
// lib/services/links.test.ts): every builder method returns the builder,
// awaiting it resolves the configured result, and each terminal call is
// recorded so wiring can be asserted without a database.
function stubBuilder(result: { data?: unknown; error?: unknown }) {
	const calls: Array<{ op: string; payload: unknown }> = [];

	const from = vi.fn(() => {
		// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
		const builder: any = {};
		const record = (op: string) => (payload: unknown) => {
			calls.push({ op, payload });
			return builder;
		};
		builder.insert = record("insert");
		builder.update = record("update");
		builder.select = () => builder;
		builder.order = record("order");
		builder.limit = record("limit");
		builder.eq = (col: string, value: unknown) => {
			calls.push({ op: "eq", payload: { col, value } });
			return builder;
		};
		builder.is = (col: string, value: unknown) => {
			calls.push({ op: "is", payload: { col, value } });
			return builder;
		};
		builder.single = async () => result;
		// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
		builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(result).then(resolve, reject);
		return builder;
	});

	return { sb: { from } as unknown as SupabaseClient, calls };
}

describe("listInboxTasks", () => {
	it("narrows to open tasks with no domain at all", async () => {
		const { sb, calls } = stubBuilder({ data: [], error: null });

		await listInboxTasks(sb);

		expect(calls).toContainEqual({ op: "eq", payload: { col: "status", value: "open" } });
		// `is`, not `eq` — an unfiled task is one whose domain_id is NULL, and
		// `eq(domain_id, null)` would match nothing in Postgres.
		expect(calls).toContainEqual({ op: "is", payload: { col: "domain_id", value: null } });
	});
});

describe("createTask", () => {
	it("leaves a task with no stated domain unfiled", async () => {
		const { sb, calls } = stubBuilder({ data: { id: "task-1" }, error: null });

		await createTask(sb, { title: "ligar pro médico" });

		expect(calls[0]).toMatchObject({
			op: "insert",
			payload: { domain_id: null, source: "manual" },
		});
	});

	it("leaves a stated domain alone", async () => {
		const { sb, calls } = stubBuilder({ data: { id: "task-1" }, error: null });

		await createTask(sb, { title: "ship it", domain_id: "dom-code" });

		expect(calls[0]).toMatchObject({ op: "insert", payload: { domain_id: "dom-code" } });
	});

	// due_time may only be set alongside a due_date (DB check constraint).
	// createTask is the one chokepoint every write path shares — form and
	// capture alike — so it coerces defensively, mirroring updateTask.
	it("nulls due_time when no due_date is given", async () => {
		const { sb, calls } = stubBuilder({ data: { id: "task-1" }, error: null });

		await createTask(sb, { title: "ligar pro dentista", due_time: "15:00" });

		expect(calls[0]).toMatchObject({
			op: "insert",
			payload: { due_time: null },
		});
	});

	it("leaves due_time alone when due_date is set", async () => {
		const { sb, calls } = stubBuilder({ data: { id: "task-1" }, error: null });

		await createTask(sb, {
			title: "ligar pro dentista",
			due_date: "2026-08-01",
			due_time: "15:00",
		});

		expect(calls[0]).toMatchObject({
			op: "insert",
			payload: { due_date: "2026-08-01", due_time: "15:00" },
		});
	});
});

describe("assignDomain", () => {
	it("files a task to a real domain", async () => {
		const { sb, calls } = stubBuilder({ data: null, error: null });

		await assignDomain(sb, "task-1", "dom-code");

		expect(calls).toContainEqual({ op: "update", payload: { domain_id: "dom-code" } });
	});

	// The round trip the /inbox page performs: captured with no domain, then
	// filed. One-way filing is structural now — there is no argument to either
	// call that would put the task back (docs/adr/0027) — so what is worth
	// covering is that the two halves agree on null as the starting state.
	it("takes a task from unfiled to filed", async () => {
		const { sb, calls } = stubBuilder({ data: { id: "task-1" }, error: null });

		await createTask(sb, { title: "comprar café" });
		await assignDomain(sb, "task-1", "dom-home");

		expect(calls[0]).toMatchObject({ op: "insert", payload: { domain_id: null } });
		expect(calls).toContainEqual({ op: "update", payload: { domain_id: "dom-home" } });
	});
});
