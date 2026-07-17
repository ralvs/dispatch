import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
	listNotifications,
	markNotification,
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
