import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

vi.mock("@/lib/services/mentions", () => ({
	syncTaskMentionsFromText: vi.fn(async () => {}),
}));

import { syncTaskMentionsFromText } from "@/lib/services/mentions";
import {
	assignDomain,
	completeTask,
	createTask,
	listInboxTasks,
	listTasks,
	setTop3,
	updateTask,
} from "@/lib/services/tasks";

beforeEach(() => {
	vi.clearAllMocks();
});

const TODAY = "2026-07-15";

// Minimal chainable stub covering exactly the call shapes completeTask uses:
// .from().select().eq().maybeSingle() (via getTaskHot), the preconditioned
// .from().update().eq()…​.select() mutation, and .from().insert().select()
// .single() (the spawned occurrence). Records every update() patch, every
// insert() payload and every predicate so tests can assert on wiring without a
// real database. `updated` is what the UPDATE…RETURNING resolves to — an empty
// array is a precondition that matched nothing.
function stubSupabase(row: Record<string, unknown>, updated: unknown[] = [{ id: row.id }]) {
	const updatePatches: Array<Record<string, unknown>> = [];
	const inserts: Array<Record<string, unknown>> = [];
	const predicates: Array<{ op: string; col: string; value: unknown }> = [];

	const sb = {
		from: vi.fn(() => ({
			select: vi.fn(() => ({
				eq: vi.fn(() => ({
					maybeSingle: vi.fn(async () => ({ data: row, error: null })),
				})),
			})),
			insert: vi.fn((payload: Record<string, unknown>) => {
				inserts.push(payload);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({
							data: { ...payload, id: "spawned" },
							error: null,
						})),
					})),
				};
			}),
			update: vi.fn((patch: Record<string, unknown>) => {
				updatePatches.push(patch);
				// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
				const builder: any = {};
				builder.eq = (col: string, value: unknown) => {
					predicates.push({ op: "eq", col, value });
					return builder;
				};
				builder.is = (col: string, value: unknown) => {
					predicates.push({ op: "is", col, value });
					return builder;
				};
				builder.select = async () => ({ data: updated, error: null });
				return builder;
			}),
		})),
	} as unknown as SupabaseClient;

	return { sb, updatePatches, inserts, predicates };
}

describe("completeTask", () => {
	// docs/adr/0059: a recurring tick closes the row it landed on and creates
	// the next occurrence beside it, so the day it was ticked keeps a done row.
	it("closes a recurring task and spawns the next occurrence", async () => {
		const { sb, updatePatches, inserts } = stubSupabase({
			id: "task-1",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
		});

		const result = await completeTask(sb, "task-1", TODAY, { dueDate: "2026-07-10" });

		expect(result).toMatchObject({ spawned: true, applied: true, nextDue: "2026-07-22" });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0]).toMatchObject({ status: "done" });
		expect(updatePatches[0].completed_at).toEqual(expect.any(String));
		// The closed occurrence keeps no rule — re-ticking it can never fork the
		// series, because the rule now lives on the row that was just created.
		expect(updatePatches[0]).toMatchObject({ recurrence_rule: null });
		// The due date is the successor's business; the closed row keeps its own.
		expect(updatePatches[0]).not.toHaveProperty("due_date");
		expect(inserts).toHaveLength(1);
		expect(inserts[0]).toMatchObject({
			title: "Weekly",
			due_date: "2026-07-22",
			recurrence_rule: "weekly",
		});
	});

	it("sets status done and completed_at for a non-recurring task", async () => {
		const { sb, updatePatches, inserts } = stubSupabase({
			id: "task-2",
			recurrence_rule: null,
			due_date: "2026-07-10",
		});

		const result = await completeTask(sb, "task-2", TODAY, { dueDate: "2026-07-10" });

		expect(result).toMatchObject({ spawned: false, applied: true });
		expect(updatePatches).toHaveLength(1);
		expect(updatePatches[0]).toMatchObject({ status: "done", recurrence_rule: null });
		expect(updatePatches[0].completed_at).toEqual(expect.any(String));
		expect(inserts).toHaveLength(0);
	});

	// A recurring "daily 09:00" task keeps its 09:00 across every occurrence.
	it("carries due_time onto the spawned occurrence", async () => {
		const { sb, inserts } = stubSupabase({
			id: "task-3",
			title: "Meds",
			recurrence_rule: "daily",
			due_date: "2026-07-10",
			due_time: "09:00:00",
		});

		const result = await completeTask(sb, "task-3", TODAY, { dueDate: "2026-07-10" });

		expect(result).toMatchObject({ spawned: true });
		expect(inserts[0]).toMatchObject({ due_time: "09:00:00" });
	});

	// The star follows the series rather than the finished row: a task pinned to
	// the day you ticked it comes back pinned to the day it is next due.
	it("moves a star onto the spawned occurrence's due date", async () => {
		const { sb, inserts } = stubSupabase({
			id: "task-8",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
			top3_for_date: TODAY,
		});

		await completeTask(sb, "task-8", TODAY, { dueDate: "2026-07-10" });

		expect(inserts[0]).toMatchObject({ top3_for_date: "2026-07-22" });
	});

	it("spawns an unstarred occurrence when the completed one was not starred", async () => {
		const { sb, inserts } = stubSupabase({
			id: "task-9",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
			top3_for_date: null,
		});

		await completeTask(sb, "task-9", TODAY, { dueDate: "2026-07-10" });

		expect(inserts[0]).toMatchObject({ top3_for_date: null });
	});

	// ── The replay guard (docs/adr/0037, tightened by 0043) ──────────────────

	it("carries the observed due_date as an UPDATE predicate", async () => {
		const { sb, predicates } = stubSupabase({
			id: "task-4",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
		});

		await completeTask(sb, "task-4", TODAY, { dueDate: "2026-07-10" });

		expect(predicates).toContainEqual({ op: "eq", col: "due_date", value: "2026-07-10" });
	});

	// `= NULL` matches nothing in Postgres, and a recurring task may
	// legitimately have no due date — nextDueDate accepts a null currentDue.
	it("uses is(), not eq(), when the observed due date is null", async () => {
		const { sb, predicates } = stubSupabase({
			id: "task-5",
			recurrence_rule: "weekly",
			due_date: null,
		});

		await completeTask(sb, "task-5", TODAY, { dueDate: null });

		expect(predicates).toContainEqual({ op: "is", col: "due_date", value: null });
		expect(predicates).not.toContainEqual({ op: "eq", col: "due_date", value: null });
	});

	// The headline case, and the reason the insert is gated on the close having
	// moved a row: a second click that matched nothing must not leave a
	// duplicate occurrence behind.
	it("makes a replayed complete against a moved occurrence a no-op", async () => {
		const { sb, updatePatches, inserts } = stubSupabase(
			{ id: "task-6", recurrence_rule: "weekly", due_date: "2026-07-17" },
			[],
		);

		const result = await completeTask(sb, "task-6", TODAY, { dueDate: "2026-07-10" });

		expect(result).toMatchObject({ spawned: false, applied: false });
		expect(updatePatches).toHaveLength(1); // attempted once, never retried
		expect(inserts).toHaveLength(0);
	});

	it("guards a recurring close on status=open", async () => {
		const { sb, predicates } = stubSupabase({
			id: "task-10",
			recurrence_rule: "weekly",
			due_date: null,
		});

		await completeTask(sb, "task-10", TODAY, { dueDate: null });

		expect(predicates).toContainEqual({ op: "eq", col: "status", value: "open" });
	});

	it("guards a non-recurring close on status=open", async () => {
		const { sb, predicates } = stubSupabase({
			id: "task-7",
			recurrence_rule: null,
			due_date: null,
		});

		await completeTask(sb, "task-7", TODAY, { dueDate: null });

		expect(predicates).toContainEqual({ op: "eq", col: "status", value: "open" });
	});
});

describe("setTop3", () => {
	// Starring is idempotent by construction: same day in, same row out,
	// however many times it lands. No read, so no lost update to have.
	it("stars unconditionally and without reading first", async () => {
		const { sb, calls } = stubBuilder({ data: [{ id: "task-1" }], error: null });

		const result = await setTop3(sb, "task-1", { forDateIso: TODAY, starred: true });

		expect(result).toEqual({ applied: true });
		expect(calls).toContainEqual({ op: "update", payload: { top3_for_date: TODAY } });
		expect(calls.filter((c) => c.op === "eq")).toEqual([
			{ op: "eq", payload: { col: "id", value: "task-1" } },
		]);
	});

	// The day predicate is what keeps Today's day navigation honest: unstarring
	// while reading tomorrow must not clear today's star.
	it("guards an unstar on the day it is clearing", async () => {
		const { sb, calls } = stubBuilder({ data: [{ id: "task-1" }], error: null });

		await setTop3(sb, "task-1", { forDateIso: "2026-07-16", starred: false });

		expect(calls).toContainEqual({ op: "update", payload: { top3_for_date: null } });
		expect(calls).toContainEqual({
			op: "eq",
			payload: { col: "top3_for_date", value: "2026-07-16" },
		});
	});

	it("reports an unstar whose day no longer matches as unapplied", async () => {
		const { sb } = stubBuilder({ data: [], error: null });

		await expect(
			setTop3(sb, "task-1", { forDateIso: "2026-07-16", starred: false }),
		).resolves.toEqual({ applied: false });
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
		builder.neq = (col: string, value: unknown) => {
			calls.push({ op: "neq", payload: { col, value } });
			return builder;
		};
		builder.or = record("or");
		builder.single = async () => result;
		builder.maybeSingle = async () => result;
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
		expect(syncTaskMentionsFromText).toHaveBeenCalledWith(sb, "task-1", "ligar pro médico", null, {
			fail: "throw",
		});
	});

	it("swallows graph failure when graphFail is swallow", async () => {
		const { sb } = stubBuilder({ data: { id: "task-1" }, error: null });
		(syncTaskMentionsFromText as Mock).mockResolvedValueOnce(undefined);

		await createTask(sb, { title: "call @Ana" }, { graphFail: "swallow" });

		expect(syncTaskMentionsFromText).toHaveBeenCalledWith(sb, "task-1", "call @Ana", null, {
			fail: "swallow",
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

// ─────────────────────────────────────────────────────────────────────────
// Quiet tasks: undated work in a project that is not active. The rule lives
// on projects.status, so listTasks reads the quiet project ids first and then
// negates "undated AND in a quiet project" in one PostgREST `or`.
// ─────────────────────────────────────────────────────────────────────────

/** Table-aware double: `projects` answers the quiet lookup, `tasks` the list. */
function stubBoard(quietProjects: Array<{ id: string }>) {
	const calls: Array<{ op: string; payload: unknown }> = [];
	const from = vi.fn((table: string) => {
		const result =
			table === "projects" ? { data: quietProjects, error: null } : { data: [], error: null };
		// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
		const builder: any = {};
		const record = (op: string) => (payload: unknown) => {
			calls.push({ op, payload });
			return builder;
		};
		builder.select = () => builder;
		builder.order = () => builder;
		builder.eq = () => builder;
		builder.is = () => builder;
		builder.neq = () => builder;
		builder.or = record("or");
		// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
		builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(result).then(resolve, reject);
		return builder;
	});
	return { sb: { from } as unknown as SupabaseClient, calls };
}

describe("listTasks · excludeQuiet", () => {
	it("keeps dated tasks, unprojected tasks, and tasks in active projects", async () => {
		const { sb, calls } = stubBoard([{ id: "p-paused" }, { id: "p-archived" }]);

		await listTasks(sb, { status: "open", excludeQuiet: true });

		const or = calls.find((c) => c.op === "or");
		expect(or).toBeDefined();
		// A due date always wins; a task with no project is never quiet; a task
		// in an active project is never quiet.
		expect(or?.payload).toBe(
			"due_date.not.is.null,project_id.is.null,project_id.not.in.(p-paused,p-archived)",
		);
	});

	it("skips the filter entirely when every project is active", async () => {
		const { sb, calls } = stubBoard([]);

		await listTasks(sb, { status: "open", excludeQuiet: true });

		expect(calls.some((c) => c.op === "or")).toBe(false);
	});

	it("does not touch the query when excludeQuiet is off", async () => {
		const { sb, calls } = stubBoard([{ id: "p-paused" }]);

		await listTasks(sb, { status: "open" });

		expect(calls.some((c) => c.op === "or")).toBe(false);
	});
});
