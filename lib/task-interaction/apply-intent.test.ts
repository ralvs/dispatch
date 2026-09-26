import { describe, expect, it } from "vitest";
import type { DaySchedule } from "@/lib/day-schedule";
import { applyDayIntent } from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/schemas/task";
import {
	applyDayTaskList,
	applyTaskLists,
	completeTaskFields,
	nextCompleteFields,
	projectComplete,
} from "@/lib/task-interaction/apply-intent";

const TODAY = "2026-07-15";

function task(partial: Partial<TaskRow> & Pick<TaskRow, "id" | "title">): TaskRow {
	return {
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 3,
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

function emptySchedule(overrides: Partial<DaySchedule> = {}): DaySchedule {
	return { allDay: [], timeline: [], top3: [], open: [], ...overrides };
}

describe("applyTaskLists", () => {
	it("marks a non-recurring task done and moves it to done", () => {
		const open = [task({ id: "a", title: "Ship" })];
		const next = applyTaskLists(
			{ open, done: [] },
			{ type: "complete", id: "a", observedDueDate: null },
			{ todayIso: TODAY, nowIso: "2026-07-15T18:00:00.000Z" },
		);
		expect(next.open).toHaveLength(0);
		expect(next.done[0]).toMatchObject({
			id: "a",
			status: "done",
			completed_at: "2026-07-15T18:00:00.000Z",
		});
	});

	// docs/adr/0059: a recurring tick closes the row it landed on, keeping its
	// own due date, and gives up the rule. The successor is a server-created
	// row, so it is deliberately absent from the optimistic projection — it
	// arrives with the RSC payload.
	it("closes a recurring task and leaves its successor to the server", () => {
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
			{ type: "complete", id: "r", observedDueDate: null },
			{ todayIso: TODAY },
		);
		expect(next.open).toHaveLength(0);
		expect(next.done).toHaveLength(1);
		expect(next.done[0]?.status).toBe("done");
		expect(next.done[0]?.due_date).toBe("2026-07-10");
		expect(next.done[0]?.recurrence_rule).toBeNull();
	});

	// The reducer is now idempotent for recurring completes, which is what
	// dropped rule off the closed row buys: a replayed tick finds a done row
	// with no rule and closes nothing twice. The lock
	// (lib/task-interaction/intent-lock.ts, docs/adr/0037) still runs first,
	// but it is no longer the only thing between a double click and a second
	// occurrence — see completeTask's status=open guard.
	it("is idempotent when the same recurring task is completed twice", () => {
		const open = [
			task({ id: "r", title: "Weekly", recurrence_rule: "weekly", due_date: "2026-07-10" }),
		];
		const once = applyTaskLists(
			{ open, done: [] },
			{ type: "complete", id: "r", observedDueDate: null },
			{ todayIso: TODAY },
		);
		const twice = applyTaskLists(
			once,
			{ type: "complete", id: "r", observedDueDate: null },
			{ todayIso: TODAY },
		);

		expect(once.done).toHaveLength(1);
		expect(twice.done).toHaveLength(1);
		expect(twice.done[0]?.due_date).toBe("2026-07-10");
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

	it("sets top-3 desired state for today", () => {
		const open = [task({ id: "t", title: "Star me" })];
		const starred = applyTaskLists(
			{ open, done: [] },
			{ type: "setTop3", id: "t", starred: true, forDateIso: TODAY },
			{ todayIso: TODAY },
		);
		expect(starred.open[0]?.top3_for_date).toBe(TODAY);
		const cleared = applyTaskLists(
			starred,
			{ type: "setTop3", id: "t", starred: false, forDateIso: TODAY },
			{ todayIso: TODAY },
		);
		expect(cleared.open[0]?.top3_for_date).toBeNull();
	});

	// Today's day navigation stars against the day on screen, so the optimistic
	// patch has to pin to that day — otherwise the row flashes into the shortlist
	// and back out when the server answers with a different date.
	it("pins top-3 to the day on screen via forDateIso", () => {
		const other = "2026-07-31";
		const open = [task({ id: "t", title: "Star me" })];
		const starred = applyTaskLists(
			{ open, done: [] },
			{ type: "setTop3", id: "t", starred: true, forDateIso: other },
			{ todayIso: TODAY },
		);
		expect(starred.open[0]?.top3_for_date).toBe(other);

		// Unstarring only clears when it is that same day's star.
		const cleared = applyTaskLists(
			starred,
			{ type: "setTop3", id: "t", starred: false, forDateIso: other },
			{ todayIso: TODAY },
		);
		expect(cleared.open[0]?.top3_for_date).toBeNull();

		// Starring for another day replaces the pin.
		const moved = applyTaskLists(
			starred,
			{ type: "setTop3", id: "t", starred: true, forDateIso: TODAY },
			{ todayIso: TODAY },
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

describe("completeTaskFields", () => {
	it("closes a recurring task on both surfaces", () => {
		const t = task({
			id: "r",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
			top3_for_date: TODAY,
		});
		const closed = completeTaskFields(t, { todayIso: TODAY }, { clearTop3: true });
		expect(closed.status).toBe("done");
		expect(closed.due_date).toBe("2026-07-10");
		expect(closed.recurrence_rule).toBeNull();
		// The row is done now, so clearTop3 reaches it like any other close —
		// the star the series keeps is written by the server onto the successor.
		expect(closed.top3_for_date).toBeNull();
	});

	it("clears top3 only when asked", () => {
		const t = task({ id: "a", title: "Go", top3_for_date: TODAY });
		expect(
			completeTaskFields(
				t,
				{ todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` },
				{ clearTop3: true },
			).top3_for_date,
		).toBeNull();
		expect(
			completeTaskFields(
				t,
				{ todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` },
				{ clearTop3: false },
			).top3_for_date,
		).toBe(TODAY);
	});
});

describe("projectComplete", () => {
	it("is the close both adapters share, and names the successor's due date", () => {
		const t = task({
			id: "r",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
		});
		const next = projectComplete(t, { todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` });
		expect(nextCompleteFields(t, { todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` })).toEqual({
			completed_at: `${TODAY}T12:00:00.000Z`,
			spawn: { due_date: "2026-07-17" },
		});
		expect(next).toMatchObject({ id: "r", status: "done", due_date: "2026-07-10" });
		expect(next.recurrence_rule).toBeNull();
	});

	it("closes a non-recurring task", () => {
		const t = task({ id: "a", title: "Go" });
		const next = projectComplete(t, { todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` });
		expect(next).toMatchObject({
			status: "done",
			completed_at: `${TODAY}T12:00:00.000Z`,
		});
	});
});

describe("applyDayTaskList", () => {
	const ctx = { todayIso: TODAY, nowIso: `${TODAY}T15:00:00.000Z` };

	it("marks a completed task done in place instead of removing it", () => {
		const tasks = [task({ id: "a", title: "Go" }), task({ id: "b", title: "Stay" })];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a", observedDueDate: null }, ctx);
		expect(next.map((t) => t.id)).toEqual(["a", "b"]);
		expect(next[0].status).toBe("done");
		expect(next[0].completed_at).toBe(ctx.nowIso);
	});

	// The server never clears top3_for_date on completion; clearing it here
	// would flash a starred row out of Top 3 and back in on the next render.
	it("leaves top3_for_date alone when completing", () => {
		const tasks = [task({ id: "a", title: "Go", top3_for_date: TODAY })];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a", observedDueDate: null }, ctx);
		expect(next[0].top3_for_date).toBe(TODAY);
	});

	it("closes a recurring task in place, keeping the day it was ticked", () => {
		const tasks = [
			task({ id: "a", title: "Water plants", due_date: TODAY, recurrence_rule: "daily" }),
		];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a", observedDueDate: null }, ctx);
		expect(next[0].status).toBe("done");
		expect(next[0].due_date).toBe(TODAY);
		expect(next[0].recurrence_rule).toBeNull();
	});

	it("reopens a done task in place", () => {
		const tasks = [
			task({ id: "a", title: "Go", status: "done", completed_at: `${TODAY}T13:00:00.000Z` }),
		];
		const next = applyDayTaskList(tasks, { type: "reopen", id: "a" }, ctx);
		expect(next.map((t) => t.id)).toEqual(["a"]);
		expect(next[0].status).toBe("open");
		expect(next[0].completed_at).toBeNull();
	});

	it("sets the star on a row whatever its status", () => {
		const tasks = [task({ id: "a", title: "Go", status: "done" })];
		const starred = applyDayTaskList(
			tasks,
			{ type: "setTop3", id: "a", starred: true, forDateIso: TODAY },
			ctx,
		);
		expect(starred[0].top3_for_date).toBe(TODAY);
		expect(
			applyDayTaskList(
				starred,
				{ type: "setTop3", id: "a", starred: false, forDateIso: TODAY },
				ctx,
			)[0].top3_for_date,
		).toBeNull();
	});
});

describe("applyDayIntent", () => {
	const ctx = {
		dateIso: TODAY,
		todayIso: TODAY,
		nowIso: `${TODAY}T15:00:00.000Z`,
		tz: "UTC",
	};

	it("keeps a completed non-recurring task on its band (ADR-0038)", () => {
		const t = task({ id: "a", title: "Go", due_date: TODAY });
		const schedule = emptySchedule({ open: [t] });
		const next = applyDayIntent(
			schedule,
			{ type: "complete", id: "a", observedDueDate: null },
			ctx,
		);
		// placeOnDay: due today without a time → the open band, ticked.
		expect(next.open).toHaveLength(1);
		expect(next.open[0]?.status).toBe("done");
		expect(next.allDay).toHaveLength(0);
	});

	// The whole point of docs/adr/0059: the day you ticked a recurring task
	// keeps a done row standing on it, instead of watching the only row roll
	// away and leave the day claiming the task was never done.
	it("keeps a completed recurring task on the day, ticked", () => {
		const t = task({
			id: "r",
			title: "Weekly",
			due_date: TODAY,
			recurrence_rule: "daily",
		});
		const schedule = emptySchedule({ open: [t] });
		const next = applyDayIntent(
			schedule,
			{ type: "complete", id: "r", observedDueDate: null },
			ctx,
		);
		expect(next.allDay).toHaveLength(0);
		expect(next.open).toHaveLength(1);
		expect(next.open[0]?.status).toBe("done");
	});

	it("moves a row into Top 3 when starred", () => {
		const t = task({ id: "a", title: "Go", due_date: TODAY });
		const schedule = emptySchedule({ open: [t] });
		const next = applyDayIntent(
			schedule,
			{ type: "setTop3", id: "a", starred: true, forDateIso: TODAY },
			ctx,
		);
		expect(next.top3.map((x) => x.id)).toEqual(["a"]);
		expect(next.open).toHaveLength(0);
	});
});
