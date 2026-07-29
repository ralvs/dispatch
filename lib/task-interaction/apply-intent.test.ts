import { describe, expect, it } from "vitest";
import type { TaskRow } from "@/lib/schemas/task";
import { applyOpenTaskList, applyTaskLists } from "@/lib/task-interaction/apply-intent";

const TODAY = "2026-07-15";

function task(partial: Partial<TaskRow> & Pick<TaskRow, "id" | "title">): TaskRow {
	return {
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 4,
		project_id: null,
		domain_id: "domain-1",
		recurrence_rule: null,
		top3_for_date: null,
		source: "manual",
		created_at: "2026-07-01T12:00:00.000Z",
		completed_at: null,
		domain: { id: "domain-1", name: "Engine", color: null },
		project: null,
		...partial,
	};
}

describe("applyTaskLists", () => {
	it("marks a non-recurring task done and moves it to done", () => {
		const open = [task({ id: "a", title: "Ship" })];
		const next = applyTaskLists(
			{ open, done: [] },
			{ type: "complete", id: "a" },
			{ todayIso: TODAY, nowIso: "2026-07-15T18:00:00.000Z" },
		);
		expect(next.open).toHaveLength(0);
		expect(next.done[0]).toMatchObject({
			id: "a",
			status: "done",
			completed_at: "2026-07-15T18:00:00.000Z",
		});
	});

	it("rolls a recurring task due date and keeps it open", () => {
		const open = [
			task({
				id: "r",
				title: "Weekly",
				recurrence_rule: "weekly",
				due_date: "2026-07-10",
			}),
		];
		const next = applyTaskLists(
			{ open, done: [] },
			{ type: "complete", id: "r" },
			{ todayIso: TODAY },
		);
		expect(next.open).toHaveLength(1);
		expect(next.open[0]?.status).toBe("open");
		expect(next.open[0]?.due_date).toBe("2026-07-22");
		expect(next.done).toHaveLength(0);
	});

	it("reopens a done task", () => {
		const done = [
			task({ id: "d", title: "Back", status: "done", completed_at: "2026-07-14T00:00:00.000Z" }),
		];
		const next = applyTaskLists(
			{ open: [], done },
			{ type: "reopen", id: "d" },
			{ todayIso: TODAY },
		);
		expect(next.done).toHaveLength(0);
		expect(next.open[0]).toMatchObject({ id: "d", status: "open", completed_at: null });
	});

	it("toggles top-3 for today", () => {
		const open = [task({ id: "t", title: "Star me" })];
		const starred = applyTaskLists(
			{ open, done: [] },
			{ type: "toggleTop3", id: "t" },
			{ todayIso: TODAY },
		);
		expect(starred.open[0]?.top3_for_date).toBe(TODAY);
		const cleared = applyTaskLists(starred, { type: "toggleTop3", id: "t" }, { todayIso: TODAY });
		expect(cleared.open[0]?.top3_for_date).toBeNull();
	});

	// Today's day navigation stars against the day on screen, so the optimistic
	// patch has to pin to that day — otherwise the row flashes into the shortlist
	// and back out when the server answers with a different date.
	it("toggles top-3 for the day on screen when one is given", () => {
		const other = "2026-07-31";
		const open = [task({ id: "t", title: "Star me" })];
		const starred = applyTaskLists(
			{ open, done: [] },
			{ type: "toggleTop3", id: "t" },
			{ todayIso: TODAY, top3DateIso: other },
		);
		expect(starred.open[0]?.top3_for_date).toBe(other);

		// Unstarring only clears when it is that same day's star.
		const cleared = applyTaskLists(
			starred,
			{ type: "toggleTop3", id: "t" },
			{ todayIso: TODAY, top3DateIso: other },
		);
		expect(cleared.open[0]?.top3_for_date).toBeNull();

		// A different day's star is replaced, not cleared.
		const moved = applyTaskLists(
			starred,
			{ type: "toggleTop3", id: "t" },
			{ todayIso: TODAY, top3DateIso: TODAY },
		);
		expect(moved.open[0]?.top3_for_date).toBe(TODAY);
	});

	it("prepends a created task", () => {
		const open = [task({ id: "old", title: "Old" })];
		const created = task({ id: "new", title: "New" });
		const next = applyTaskLists(
			{ open, done: [] },
			{ type: "create", task: created },
			{ todayIso: TODAY },
		);
		expect(next.open.map((t) => t.id)).toEqual(["new", "old"]);
	});

	it("deletes from open or done", () => {
		const lists = {
			open: [task({ id: "a", title: "A" })],
			done: [task({ id: "b", title: "B", status: "done" })],
		};
		expect(applyTaskLists(lists, { type: "delete", id: "a" }, { todayIso: TODAY }).open).toEqual(
			[],
		);
		expect(applyTaskLists(lists, { type: "delete", id: "b" }, { todayIso: TODAY }).done).toEqual(
			[],
		);
	});
});

describe("applyOpenTaskList", () => {
	it("drops completed non-recurring tasks from a flat open list", () => {
		const open = [task({ id: "a", title: "Go" }), task({ id: "b", title: "Stay" })];
		const next = applyOpenTaskList(open, { type: "complete", id: "a" }, { todayIso: TODAY });
		expect(next.map((t) => t.id)).toEqual(["b"]);
	});
});
