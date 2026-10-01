import { describe, expect, it } from "vitest";
import {
	applyIntent,
	applySeed,
	confirmWrite,
	initialState,
	rollbackWrite,
	selectAggregate,
	selectView,
} from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import { deepFreeze, NOW, notification, snapshot, T1, T2, T3 } from "@/lib/store/test-fixtures";
import type { AnyIntent, StoreState } from "@/lib/store/types";

const key = viewKey.notifications();
const a = notification({ id: "a" });
const b = notification({ id: "b", status: "read" });
const c = notification({ id: "c" });

function seeded(readAt = T1, rows = [a, b, c], unread = 5): StoreState {
	return deepFreeze(
		applySeed(
			initialState(),
			snapshot(readAt, [{ key, type: "notificationList", data: rows }], {
				aggregates: { "notifications.unread": unread },
			}),
		),
	);
}

const intent = (i: AnyIntent["intent"]) => ({ kind: "notification", intent: i }) as AnyIntent;
const ids = (s: StoreState) => selectView(s, key)?.map((n) => `${n.id}:${n.status}`);

describe("notification adapter", () => {
	it("a seed never shows a dismissed row", () => {
		const s = seeded(T1, [a, notification({ id: "x", status: "dismissed" })]);
		expect(ids(s)).toEqual(["a:unread"]);
	});

	it("mark read flips the row and takes one off the unread count", () => {
		const [s] = applyIntent(seeded(), intent({ type: "mark", id: "a", status: "read" }), NOW);
		expect(ids(s)).toEqual(["a:read", "b:read", "c:unread"]);
		expect(selectAggregate(s, "notifications.unread")).toBe(4);
	});

	it("marking a row that was already read moves no count", () => {
		const [s] = applyIntent(seeded(), intent({ type: "mark", id: "b", status: "dismissed" }), NOW);
		expect(ids(s)).toEqual(["a:unread", "c:unread"]);
		expect(selectAggregate(s, "notifications.unread")).toBe(5);
	});

	it("a confirmed dismissal stays gone when a stale seed still has the row", () => {
		const [s1, t] = applyIntent(
			seeded(),
			intent({ type: "mark", id: "a", status: "dismissed" }),
			NOW,
		);
		const s2 = deepFreeze(confirmWrite(s1, t, { at: T2, rows: [], deletedIds: ["a"] }));
		expect(ids(s2)).toEqual(["b:read", "c:unread"]);
		// A router-cache replay read before the write.
		const stale = applySeed(
			s2,
			snapshot(T1, [{ key, type: "notificationList", data: [a, b, c] }], {
				aggregates: { "notifications.unread": 5 },
			}),
		);
		expect(ids(stale)).toEqual(["b:read", "c:unread"]);
		// A fresher read replaces it: the server says a is gone.
		const fresh = applySeed(
			s2,
			snapshot(T3, [{ key, type: "notificationList", data: [b, c] }], {
				aggregates: { "notifications.unread": 1 },
			}),
		);
		expect(ids(fresh)).toEqual(["b:read", "c:unread"]);
		expect(selectAggregate(fresh, "notifications.unread")).toBe(1);
	});

	it("mark all read takes the count to zero, rows this tab never loaded included", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "markAll", status: "read" }), NOW);
		expect(ids(s1)).toEqual(["a:read", "b:read", "c:read"]);
		expect(selectAggregate(s1, "notifications.unread")).toBe(0);

		const write = {
			at: T2,
			rows: [
				{ ...a, status: "read" as const },
				{ ...c, status: "read" as const },
			],
		};
		const s2 = deepFreeze(confirmWrite(s1, t, write));
		expect(ids(s2)).toEqual(["a:read", "b:read", "c:read"]);
		expect(selectAggregate(s2, "notifications.unread")).toBe(0);
	});

	it("dismiss all empties the list; a stale seed cannot bring it back", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "markAll", status: "dismissed" }), NOW);
		expect(ids(s1)).toEqual([]);
		const s2 = deepFreeze(confirmWrite(s1, t, { at: T2, rows: [], deletedIds: ["a", "b", "c"] }));
		const stale = applySeed(
			s2,
			snapshot(T1, [{ key, type: "notificationList", data: [a, b, c] }], {
				aggregates: { "notifications.unread": 5 },
			}),
		);
		expect(ids(stale)).toEqual([]);
		expect(selectAggregate(stale, "notifications.unread")).toBe(0);
	});

	it("a confirmed write never admits a row the list does not hold", () => {
		const old = notification({ id: "old", status: "read" });
		const [s1, t] = applyIntent(seeded(), intent({ type: "markAll", status: "read" }), NOW);
		// The bulk write answers with every row it changed, older ones included.
		const changed = [{ ...a, status: "read" as const }, { ...c, status: "read" as const }, old];
		const s2 = confirmWrite(s1, t, { at: T2, rows: changed });
		expect(ids(s2)).toEqual(["a:read", "b:read", "c:read"]);
	});

	it("rollback restores the rows and the count", () => {
		const s0 = seeded();
		const [s1, t] = applyIntent(s0, intent({ type: "markAll", status: "dismissed" }), NOW);
		const s2 = rollbackWrite(s1, t);
		expect(ids(s2)).toEqual(ids(s0));
		expect(selectAggregate(s2, "notifications.unread")).toBe(5);
	});

	it("with no unread count seeded, a bulk action moves no count", () => {
		const s0 = deepFreeze(
			applySeed(initialState(), snapshot(T1, [{ key, type: "notificationList", data: [a] }])),
		);
		const [s1] = applyIntent(s0, intent({ type: "markAll", status: "read" }), NOW);
		expect(s1.pending[0].deltas).toEqual({});
		expect(selectAggregate(s1, "notifications.unread")).toBeUndefined();
	});
});
