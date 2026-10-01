import { describe, expect, it } from "vitest";
import {
	applyIntent,
	applySeed,
	confirmWrite,
	initialState,
	rollbackWrite,
	selectView,
} from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import { deepFreeze, NOW, routine, snapshot, T1, T2, T3, TODAY } from "@/lib/store/test-fixtures";
import type { AnyIntent, StoreState } from "@/lib/store/types";

const key = viewKey.routines();
const YESTERDAY = "2026-07-14";
const read = routine({ id: "read", completions: [YESTERDAY] });
const run = routine({ id: "run" });

function seeded(readAt = T1, rows = [read, run]): StoreState {
	return deepFreeze(
		applySeed(initialState(), snapshot(readAt, [{ key, type: "routineList", data: rows }])),
	);
}

const intent = (i: AnyIntent["intent"]) => ({ kind: "routine", intent: i }) as AnyIntent;
const view = (s: StoreState) =>
	selectView(s, key)?.map((r) => `${r.id}:${r.completions.join(",")}`);

describe("routine adapter", () => {
	it("a tick adds the day to the row's log; untick takes it out", () => {
		const [s1] = applyIntent(
			seeded(),
			intent({ type: "toggle", id: "read", date: TODAY, done: true }),
			NOW,
		);
		expect(view(s1)).toEqual([`read:${YESTERDAY},${TODAY}`, "run:"]);
		const [s2] = applyIntent(
			s1,
			intent({ type: "toggle", id: "read", date: YESTERDAY, done: false }),
			NOW,
		);
		expect(view(s2)).toEqual([`read:${TODAY}`, "run:"]);
	});

	it("a tick names its state, so a replay changes nothing", () => {
		const [s1] = applyIntent(
			seeded(),
			intent({ type: "toggle", id: "read", date: YESTERDAY, done: true }),
			NOW,
		);
		expect(selectView(s1, key)).toEqual(selectView(seeded(), key));
	});

	it("a confirmed tick survives a stale seed and yields to a fresher one", () => {
		const [s1, t] = applyIntent(
			seeded(),
			intent({ type: "toggle", id: "run", date: TODAY, done: true }),
			NOW,
		);
		const s2 = deepFreeze(
			confirmWrite(s1, t, { at: T2, rows: [{ ...run, completions: [TODAY] }] }),
		);
		expect(view(s2)).toEqual([`read:${YESTERDAY}`, `run:${TODAY}`]);

		// A router-cache replay read before the write.
		expect(
			view(applySeed(s2, snapshot(T1, [{ key, type: "routineList", data: [read, run] }]))),
		).toEqual([`read:${YESTERDAY}`, `run:${TODAY}`]);
		// A later read says another tab unticked it: the server wins.
		expect(
			view(applySeed(s2, snapshot(T3, [{ key, type: "routineList", data: [read, run] }]))),
		).toEqual([`read:${YESTERDAY}`, "run:"]);
	});

	it("a failed tick rolls back", () => {
		const [s1, t] = applyIntent(
			seeded(),
			intent({ type: "toggle", id: "run", date: TODAY, done: true }),
			NOW,
		);
		expect(view(rollbackWrite(s1, t))).toEqual(view(seeded()));
	});

	it("a create shows at once and the server's row replaces it", () => {
		const draft = routine({ id: "draft", name: "Stretch" });
		const [s1, t] = applyIntent(seeded(), intent({ type: "create", routine: draft }), NOW);
		expect(view(s1)).toEqual([`read:${YESTERDAY}`, "run:", "draft:"]);
		const saved = routine({ id: "saved", name: "Stretch" });
		const s2 = confirmWrite(s1, t, { at: T2, rows: [saved] });
		expect(view(s2)).toEqual([`read:${YESTERDAY}`, "run:", "saved:"]);
	});

	it("an edit patches the row; a delete removes it for good", () => {
		const [s1] = applyIntent(
			seeded(),
			intent({ type: "edit", id: "run", patch: { name: "Run 5k" } }),
			NOW,
		);
		expect(selectView(s1, key)?.find((r) => r.id === "run")?.name).toBe("Run 5k");

		const [s2, t] = applyIntent(seeded(), intent({ type: "delete", id: "run" }), NOW);
		const s3 = deepFreeze(confirmWrite(s2, t, { at: T2, rows: [], deletedIds: ["run"] }));
		expect(view(s3)).toEqual([`read:${YESTERDAY}`]);
		expect(
			view(applySeed(s3, snapshot(T1, [{ key, type: "routineList", data: [read, run] }]))),
		).toEqual([`read:${YESTERDAY}`]);
	});

	it("an archived row leaves the list", () => {
		const [s1, t] = applyIntent(seeded(), intent({ type: "edit", id: "run", patch: {} }), NOW);
		const s2 = confirmWrite(s1, t, { at: T2, rows: [{ ...run, archived_at: T2 }] });
		expect(view(s2)).toEqual([`read:${YESTERDAY}`]);
	});
});
