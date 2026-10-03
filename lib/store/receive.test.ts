import { describe, expect, it } from "vitest";
import { createDispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { receiveRows } from "@/lib/store/receive";
import { NOW, note, snapshot, T0, T1, T2, T4, TODAY, TZ, task } from "@/lib/store/test-fixtures";
import type { Snapshot } from "@/lib/store/types";

const NONE = { task: [], note: [], quote: [], journal: [] };

function seeded(readAt = T1) {
	const store = createDispatchStore({ now: () => NOW });
	store.getState().seed(seedAt(readAt));
	return store;
}

function seedAt(readAt: string): Snapshot {
	return snapshot(
		readAt,
		[
			{ key: viewKey.tasks(), type: "taskLists", data: { open: [], done: [] } },
			{ key: viewKey.notes(), type: "noteLists", data: { needsReview: [], all: [] } },
		],
		{
			aggregates: {
				"tasks.open": 2,
				"tasks.overdue": 0,
				"tasks.inbox": 1,
				"notes.needsReview": 0,
			},
		},
	);
}

describe("receiveRows (a palette capture)", () => {
	const captured = task({ id: "t1", domain_id: null });
	const flagged = note({ id: "n1", needs_review: true });
	const received = {
		readAt: T0,
		todayIso: TODAY,
		tz: TZ,
		at: T2,
		rows: { ...NONE, task: [captured], note: [flagged] },
	};

	it("lists what the capture wrote and moves the counts it moves", () => {
		const store = seeded();
		receiveRows(store.getState(), received);
		const s = store.getState();
		expect(s.pending).toEqual([]);
		expect(s.views[viewKey.tasks()]?.base).toEqual({ open: [captured], done: [] });
		expect(s.views[viewKey.notes()]?.base).toEqual({ needsReview: [flagged], all: [] });
		expect(s.aggregates["tasks.open"]?.value).toBe(3);
		expect(s.aggregates["tasks.inbox"]?.value).toBe(2);
		expect(s.aggregates["notes.needsReview"]?.value).toBe(1);
	});

	it("survives a seed read before the capture landed, and is not counted twice by one read after", () => {
		const store = seeded();
		receiveRows(store.getState(), received);
		store.getState().seed(seedAt("2026-07-15T12:01:30.000Z"));
		expect(store.getState().views[viewKey.tasks()]?.base).toEqual({ open: [captured], done: [] });
		expect(store.getState().aggregates["tasks.open"]?.value).toBe(3);
		store.getState().seed({
			...seedAt("2026-07-15T12:03:00.000Z"),
			views: [{ key: viewKey.tasks(), type: "taskLists", data: { open: [captured], done: [] } }],
			aggregates: { "tasks.open": 3 },
		});
		expect(store.getState().aggregates["tasks.open"]?.value).toBe(3);
	});

	it("counts a row a seed already read only once", () => {
		const store = createDispatchStore({ now: () => NOW });
		store.getState().seed({
			...seedAt(T1),
			views: [
				{ key: viewKey.notes(), type: "noteLists", data: { needsReview: [flagged], all: [] } },
			],
			aggregates: { "notes.needsReview": 1 },
		});
		receiveRows(store.getState(), { ...received, rows: { ...NONE, note: [flagged] } });
		expect(store.getState().aggregates["notes.needsReview"]?.value).toBe(1);
	});

	it("leaves a seeded clock and its lists alone", () => {
		const store = seeded(T2);
		const clock = store.getState().clock;
		receiveRows(store.getState(), { ...received, readAt: "2026-07-15T12:05:00.000Z", at: T4 });
		expect(store.getState().clock).toBe(clock);
		expect(store.getState().views[viewKey.tasks()]?.base).toEqual({ open: [captured], done: [] });
	});

	it("gives a store no page seeded a clock instead of throwing", () => {
		const store = createDispatchStore({ now: () => NOW });
		receiveRows(store.getState(), received);
		expect(store.getState().clock).toMatchObject({ todayIso: TODAY, tz: TZ });
		expect(store.getState().confirmed).toHaveLength(2);
	});
});
