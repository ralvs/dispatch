import { describe, expect, it } from "vitest";
import {
	applyIntent,
	applySeed,
	CONFIRMED_CAP,
	confirmWrite,
	defaultAdapters,
	initialState,
	makeCore,
	rollbackWrite,
	selectView,
} from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import {
	dayPayload,
	deepFreeze,
	NOW,
	snapshot,
	T0,
	T1,
	T2,
	T3,
	T4,
	TODAY,
	task,
} from "@/lib/store/test-fixtures";
import type { StoreState, ViewSeed } from "@/lib/store/types";

const tasksKey = viewKey.tasks();
const listsSeed = (
	open = [task({ id: "a" })],
	done = [] as ReturnType<typeof task>[],
): ViewSeed => ({
	key: tasksKey,
	type: "taskLists",
	data: { open, done },
});

function seeded(readAt = T1, seed = listsSeed()): StoreState {
	return deepFreeze(applySeed(initialState(), snapshot(readAt, [seed])));
}

const complete = {
	kind: "task",
	intent: { type: "complete", id: "a", observedDueDate: null },
} as const;
const serverDone = task({ id: "a", status: "done", completed_at: "2026-07-15T12:02:10.000Z" });

describe("apply → confirm / rollback", () => {
	it("confirm replaces the projection with the server row and empties pending", () => {
		const [applied, token] = applyIntent(seeded(), complete, NOW);
		expect(selectView(applied, tasksKey)?.done[0]).toMatchObject({ id: "a", completed_at: NOW });

		const next = confirmWrite(deepFreeze(applied), token, { at: T2, rows: [serverDone] });
		expect(next.pending).toEqual([]);
		expect(next.confirmed).toHaveLength(1);
		const view = selectView(next, tasksKey);
		expect(view?.open).toEqual([]);
		expect(view?.done).toEqual([serverDone]);
	});

	it("rollback returns the base; an unknown token is a no-op", () => {
		const base = seeded();
		const [applied, token] = applyIntent(base, complete, NOW);
		const rolled = rollbackWrite(deepFreeze(applied), token);
		expect(selectView(rolled, tasksKey)).toEqual(selectView(base, tasksKey));
		expect(rollbackWrite(rolled, 999)).toBe(rolled);
		expect(confirmWrite(rolled, 999, { at: T2, rows: [] })).toBe(rolled);
	});

	it("apply throws without a clock", () => {
		expect(() => applyIntent(initialState(), complete, NOW)).toThrow(/Seed/);
	});
});

describe("conflict rule", () => {
	function confirmedAt(at = T2): StoreState {
		const [applied, token] = applyIntent(seeded(T1), complete, NOW);
		return deepFreeze(confirmWrite(applied, token, { at, rows: [serverDone] }));
	}

	it("a stale seed keeps the local effect, membership included", () => {
		const s = applySeed(confirmedAt(T3), snapshot(T2, [listsSeed()]));
		const view = selectView(s, tasksKey);
		expect(view?.open).toEqual([]);
		expect(view?.done).toEqual([serverDone]);
	});

	it("a fresh seed wins over a confirmed write", () => {
		const reopened = task({ id: "a", status: "open" });
		const s = applySeed(confirmedAt(T2), snapshot(T3, [listsSeed([reopened])]));
		expect(selectView(s, tasksKey)).toEqual({ open: [reopened], done: [] });
	});

	it("an equal or older readAt returns the same reference", () => {
		const s = seeded(T2);
		expect(applySeed(s, snapshot(T2, [listsSeed()]))).toBe(s);
		expect(applySeed(s, snapshot(T1, [listsSeed()]))).toBe(s);
	});

	it("a tombstone blocks resurrection", () => {
		const [applied, token] = applyIntent(
			seeded(T1),
			{ kind: "task", intent: { type: "delete", id: "a" } },
			NOW,
		);
		const deleted = deepFreeze(
			confirmWrite(applied, token, { at: T3, rows: [], deletedIds: ["a"] }),
		);
		expect(selectView(deleted, tasksKey)?.open).toEqual([]);
		// A stale read still holding the row does not bring it back.
		const stale = applySeed(deleted, snapshot(T2, [listsSeed()]));
		expect(selectView(stale, tasksKey)?.open).toEqual([]);
		expect(stale.rows.task.a).toMatchObject({ deleted: true });
	});

	it("a create's temp id is swapped for the server id, no duplicate under stale or fresh seed", () => {
		const temp = task({ id: "temp-1", title: "New" });
		const real = task({ id: "real-1", title: "New" });
		const [applied, token] = applyIntent(
			seeded(T1),
			{ kind: "task", intent: { type: "create", task: temp } },
			NOW,
		);
		expect(selectView(applied, tasksKey)?.open.map((t) => t.id)).toEqual(["temp-1", "a"]);
		const confirmed = deepFreeze(confirmWrite(applied, token, { at: T3, rows: [real] }));
		expect(selectView(confirmed, tasksKey)?.open.map((t) => t.id)).toEqual(["real-1", "a"]);

		const stale = applySeed(confirmed, snapshot(T2, [listsSeed()]));
		expect(selectView(stale, tasksKey)?.open.map((t) => t.id)).toEqual(["real-1", "a"]);
		const fresh = applySeed(confirmed, snapshot(T4, [listsSeed([real, task({ id: "a" })])]));
		expect(selectView(fresh, tasksKey)?.open.map((t) => t.id)).toEqual(["real-1", "a"]);
	});

	it("confirm skips a view read after the write", () => {
		const [applied, token] = applyIntent(seeded(T1), complete, NOW);
		// A read at T3 (already showing the done row) lands before the confirm at T2.
		const reseeded = applySeed(applied, snapshot(T3, [listsSeed([], [serverDone])]));
		const next = confirmWrite(deepFreeze(reseeded), token, { at: T2, rows: [serverDone] });
		expect(next.views[tasksKey]).toBe(reseeded.views[tasksKey]);
	});

	it("a seed after a pending write replaces the base and the pending intent re-folds", () => {
		const [applied] = applyIntent(seeded(T1), complete, NOW);
		const b = task({ id: "b" });
		const s = applySeed(deepFreeze(applied), snapshot(T2, [listsSeed([task({ id: "a" }), b])]));
		const view = selectView(s, tasksKey);
		expect(view?.open.map((t) => t.id)).toEqual(["b"]);
		expect(view?.done.map((t) => t.id)).toEqual(["a"]);
	});
});

describe("todayIso rollover", () => {
	const TOMORROW = "2026-07-16";
	const oldDay = viewKey.day(TODAY);

	it("advances only with a newer readAt; later intents use the new date, earlier keep theirs", () => {
		const s0 = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [
					{
						key: oldDay,
						type: "day",
						data: dayPayload(TODAY, [task({ id: "a", due_date: TODAY })]),
					},
				]),
			),
		);
		const [s1] = applyIntent(s0, complete, NOW);
		const rolled = deepFreeze(applySeed(s1, { ...snapshot(T2), todayIso: TOMORROW }));
		expect(rolled.clock?.todayIso).toBe(TOMORROW);

		// An older snapshot does not roll the clock back.
		expect(applySeed(rolled, snapshot(T1)).clock?.todayIso).toBe(TOMORROW);

		const [s2] = applyIntent(rolled, { kind: "task", intent: { type: "reopen", id: "b" } }, NOW);
		expect(s2.pending[0].ctx.todayIso).toBe(TODAY);
		expect(s2.pending[1].ctx.todayIso).toBe(TOMORROW);
		// The old day view is retained, and its done row still shows (completed on it).
		expect(selectView(s2, oldDay)?.schedule.open[0]).toMatchObject({ id: "a", status: "done" });
	});
});

describe("aggregates", () => {
	const withDeltas = makeCore({
		...defaultAdapters,
		kinds: {
			task: {
				...defaultAdapters.kinds.task,
				deltas: (intent, before) =>
					intent.type === "complete" && before?.status === "open"
						? { "notes.needsReview": -1 }
						: {},
			},
		},
	});

	function seededAgg(readAt = T1): StoreState {
		return deepFreeze(
			withDeltas.applySeed(
				initialState(),
				snapshot(readAt, [listsSeed()], { aggregates: { "notes.needsReview": 3 } }),
			),
		);
	}

	it("a pending delta shows, confirm keeps it, rollback drops it", () => {
		const [applied, token] = withDeltas.applyIntent(seededAgg(), complete, NOW);
		expect(withDeltas.selectAggregate(applied, "notes.needsReview")).toBe(2);
		expect(
			withDeltas.selectAggregate(withDeltas.rollbackWrite(applied, token), "notes.needsReview"),
		).toBe(3);
		const confirmed = withDeltas.confirmWrite(deepFreeze(applied), token, {
			at: T2,
			rows: [serverDone],
		});
		expect(withDeltas.selectAggregate(confirmed, "notes.needsReview")).toBe(2);
	});

	it("a stale seed replays the delta; a fresh seed does not double count", () => {
		const [applied, token] = withDeltas.applyIntent(seededAgg(), complete, NOW);
		const confirmed = deepFreeze(
			withDeltas.confirmWrite(applied, token, { at: T3, rows: [serverDone] }),
		);
		const stale = withDeltas.applySeed(
			confirmed,
			snapshot(T2, [], { aggregates: { "notes.needsReview": 3 } }),
		);
		expect(withDeltas.selectAggregate(stale, "notes.needsReview")).toBe(2);
		const fresh = withDeltas.applySeed(
			confirmed,
			snapshot(T4, [], { aggregates: { "notes.needsReview": 2 } }),
		);
		expect(withDeltas.selectAggregate(fresh, "notes.needsReview")).toBe(2);
	});

	it("clamps at zero and is undefined until seeded", () => {
		const s = deepFreeze(
			withDeltas.applySeed(
				initialState(),
				snapshot(T1, [listsSeed()], { aggregates: { "notes.needsReview": 0 } }),
			),
		);
		const [applied] = withDeltas.applyIntent(s, complete, NOW);
		expect(withDeltas.selectAggregate(applied, "notes.needsReview")).toBe(0);
		expect(withDeltas.selectAggregate(applied, "notifications.unread")).toBeUndefined();
	});
});

describe("purity", () => {
	it("every transition runs on deep-frozen state", () => {
		const s = seeded();
		const [a, token] = applyIntent(s, complete, NOW);
		const c = confirmWrite(deepFreeze(a), token, { at: T2, rows: [serverDone] });
		const r = applySeed(deepFreeze(c), snapshot(T0, [listsSeed()]));
		expect(() => rollbackWrite(deepFreeze(r), token)).not.toThrow();
		expect(() => selectView(deepFreeze(r), tasksKey)).not.toThrow();
	});

	it("caps confirmed writes", () => {
		let s = seeded();
		for (let i = 0; i <= CONFIRMED_CAP; i++) {
			const [a, token] = applyIntent(s, { kind: "task", intent: { type: "reopen", id: "a" } }, NOW);
			s = confirmWrite(a, token, { at: T2, rows: [] });
		}
		expect(s.confirmed).toHaveLength(CONFIRMED_CAP);
	});
});
