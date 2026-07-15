import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { ServiceError } from "@/lib/services/errors";
import {
	LedgerError,
	listNotifications,
	markNotification,
	type NotificationEntry,
	recordedAction,
	recordNotification,
	unreadCount,
} from "@/lib/services/notifications";

type StubResult = { data?: unknown; error?: unknown; count?: number };

// A chainable/thenable query-builder stub keyed by table name. Every builder
// method returns the builder; awaiting it (or .single()) resolves the
// configured result. Records each terminal insert/update so tests can assert
// on wiring without a real database. Mirrors the tasks.test.ts approach,
// generalized to the several call shapes this module uses.
function stubSupabase(results: Record<string, StubResult>) {
	const calls: Array<{ table: string; op: string; payload: unknown }> = [];

	const from = vi.fn((table: string) => {
		const res = results[table] ?? { data: null, error: null };
		// biome-ignore lint/suspicious/noExplicitAny: hand-rolled test double
		const builder: any = {};
		const record = (op: string) => (payload: unknown) => {
			calls.push({ table, op, payload });
			return builder;
		};
		builder.insert = record("insert");
		builder.update = record("update");
		builder.select = () => builder;
		builder.eq = (col: string, value: unknown) => {
			calls.push({ table, op: "eq", payload: { col, value } });
			return builder;
		};
		builder.order = record("order");
		builder.limit = record("limit");
		builder.single = async () => res;
		builder.maybeSingle = async () => res;
		// Supabase's builder is thenable (awaitable without a terminal method);
		// the stub reproduces that on purpose for list/update/count call shapes.
		// biome-ignore lint/suspicious/noThenProperty: intentional thenable test double
		builder.then = (resolve: (v: StubResult) => unknown, reject: (e: unknown) => unknown) =>
			Promise.resolve(res).then(resolve, reject);
		return builder;
	});

	return { sb: { from } as unknown as SupabaseClient, calls };
}

// Entry derived from the action's result — the whole point of the entryFor
// signature: the created row's id lands in source_ref, unknowable up front.
const entryFor = (result: { id: string }): NotificationEntry => ({
	type: "task.created",
	title: "Created a task from your voice note",
	source_ref: result.id,
});

describe("recordedAction", () => {
	it("derives the entry from the action's result, then records the ledger row", async () => {
		const { sb, calls } = stubSupabase({
			notifications: { data: { id: "n1", type: "task.created" }, error: null },
		});
		const action = vi.fn(async () => ({ id: "task-1" }));

		const { result, notification } = await recordedAction(sb, action, entryFor);

		expect(action).toHaveBeenCalledWith(sb);
		expect(result).toEqual({ id: "task-1" });
		expect(notification).toMatchObject({ id: "n1" });
		expect(calls).toEqual([
			{
				table: "notifications",
				op: "insert",
				// source_ref carries the id only knowable *after* the action ran.
				payload: expect.objectContaining({ type: "task.created", source_ref: "task-1" }),
			},
		]);
	});

	it("does not record and does not swallow when the action itself fails", async () => {
		const { sb, calls } = stubSupabase({ notifications: { data: null, error: null } });
		const action = vi.fn(async () => {
			throw new Error("boom");
		});

		await expect(recordedAction(sb, action, entryFor)).rejects.toThrow("boom");
		// Action ran before any ledger write, so nothing was recorded.
		expect(calls).toHaveLength(0);
	});

	it("throws LedgerError carrying result + entry when the action succeeded but the ledger insert failed", async () => {
		const { sb } = stubSupabase({
			notifications: { data: null, error: { message: "db down", code: "08006" } },
		});
		const action = vi.fn(async () => ({ id: "task-1" }));

		try {
			await recordedAction(sb, action, entryFor);
			throw new Error("recordedAction should have thrown");
		} catch (err) {
			expect(err).toBeInstanceOf(LedgerError);
			const ledgerError = err as LedgerError;
			// The action's real, un-rolled-back result survives on the throw path.
			expect(ledgerError.result).toEqual({ id: "task-1" });
			expect(ledgerError.entry).toEqual(entryFor({ id: "task-1" }));
			// Underlying Postgres code is preserved for the caller to branch on.
			expect(ledgerError.code).toBe("08006");
			expect(ledgerError).toBeInstanceOf(ServiceError);
		}
	});
});

describe("recordNotification", () => {
	it("inserts an actionless ledger row and coerces omitted fields to null", async () => {
		const { sb, calls } = stubSupabase({
			notifications: { data: { id: "n2" }, error: null },
		});

		const row = await recordNotification(sb, { type: "reminder.fired", title: "Standup in 10m" });

		expect(row).toMatchObject({ id: "n2" });
		expect(calls[0].payload).toEqual({
			type: "reminder.fired",
			title: "Standup in 10m",
			body: null,
			source_ref: null,
			source_url: null,
			undo_payload: null,
		});
	});
});

describe("read surface", () => {
	it("listNotifications returns the rows", async () => {
		const rows = [{ id: "a" }, { id: "b" }];
		const { sb } = stubSupabase({ notifications: { data: rows, error: null } });
		expect(await listNotifications(sb, { status: "unread", limit: 20 })).toEqual(rows);
	});

	it("listNotifications applies status filter, limit, and newest-first order", async () => {
		const { sb, calls } = stubSupabase({ notifications: { data: [], error: null } });
		await listNotifications(sb, { status: "unread", limit: 20 });
		expect(calls).toEqual([
			{ table: "notifications", op: "order", payload: "created_at" },
			{ table: "notifications", op: "eq", payload: { col: "status", value: "unread" } },
			{ table: "notifications", op: "limit", payload: 20 },
		]);
	});

	it("listNotifications omits status/limit filters when not requested", async () => {
		const { sb, calls } = stubSupabase({ notifications: { data: [], error: null } });
		await listNotifications(sb);
		expect(calls).toEqual([{ table: "notifications", op: "order", payload: "created_at" }]);
	});

	it("unreadCount returns the exact head count", async () => {
		const { sb } = stubSupabase({ notifications: { count: 3, error: null } });
		expect(await unreadCount(sb)).toBe(3);
	});

	it("markNotification updates status by id", async () => {
		const { sb, calls } = stubSupabase({ notifications: { data: null, error: null } });
		await markNotification(sb, "n1", "read");
		expect(calls).toEqual([
			{ table: "notifications", op: "update", payload: { status: "read" } },
			{ table: "notifications", op: "eq", payload: { col: "id", value: "n1" } },
		]);
	});
});
