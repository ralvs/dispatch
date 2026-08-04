import { describe, expect, it } from "vitest";
import type { TaskRow } from "@/lib/schemas/task";
import type { DaySchedule } from "@/lib/services/today";
import {
	applyDayIntent,
	applyDayTaskList,
	applyTaskLists,
	completeTaskFields,
} from "@/lib/task-interaction/apply-intent";

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

function emptySchedule(overrides: Partial<DaySchedule> = {}): DaySchedule {
	return { allDay: [], timeline: [], top3: [], open: [], ...overrides };
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

	// Characterization, not a wish: the reducer is deliberately NOT idempotent
	// here. Early completion of a not-yet-due recurring task has to roll too
	// (nextDueDate starts from max(currentDue, today)), so any "only roll if
	// due_date <= todayIso" rule would silently break it. Replay is stopped a
	// layer up instead — see lib/task-interaction/intent-lock.ts and
	// docs/adr/0037. This test is the reason that lock exists.
	it("rolls two intervals when the same recurring task is completed twice", () => {
		const open = [
			task({ id: "r", title: "Weekly", recurrence_rule: "weekly", due_date: "2026-07-10" }),
		];
		const once = applyTaskLists(
			{ open, done: [] },
			{ type: "complete", id: "r" },
			{ todayIso: TODAY },
		);
		const twice = applyTaskLists(once, { type: "complete", id: "r" }, { todayIso: TODAY });

		expect(once.open[0]?.due_date).toBe("2026-07-22");
		expect(twice.open[0]?.due_date).toBe("2026-07-29");
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

describe("completeTaskFields", () => {
	it("shares roll math for both surfaces", () => {
		const t = task({
			id: "r",
			title: "Weekly",
			recurrence_rule: "weekly",
			due_date: "2026-07-10",
			top3_for_date: TODAY,
		});
		const rolled = completeTaskFields(t, { todayIso: TODAY }, { clearTop3: true });
		expect(rolled.due_date).toBe("2026-07-22");
		expect(rolled.status).toBe("open");
		// clearTop3 only applies to non-recurring completion.
		expect(rolled.top3_for_date).toBe(TODAY);
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

describe("applyDayTaskList", () => {
	const ctx = { todayIso: TODAY, nowIso: `${TODAY}T15:00:00.000Z` };

	it("marks a completed task done in place instead of removing it", () => {
		const tasks = [task({ id: "a", title: "Go" }), task({ id: "b", title: "Stay" })];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a" }, ctx);
		expect(next.map((t) => t.id)).toEqual(["a", "b"]);
		expect(next[0].status).toBe("done");
		expect(next[0].completed_at).toBe(ctx.nowIso);
	});

	// The server never clears top3_for_date on completion; clearing it here
	// would flash a starred row out of Top 3 and back in on the next render.
	it("leaves top3_for_date alone when completing", () => {
		const tasks = [task({ id: "a", title: "Go", top3_for_date: TODAY })];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a" }, ctx);
		expect(next[0].top3_for_date).toBe(TODAY);
	});

	it("rolls a recurring task forward and leaves it open", () => {
		const tasks = [
			task({ id: "a", title: "Water plants", due_date: TODAY, recurrence_rule: "daily" }),
		];
		const next = applyDayTaskList(tasks, { type: "complete", id: "a" }, ctx);
		expect(next[0].status).toBe("open");
		expect(next[0].due_date).toBe("2026-07-16");
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

	it("toggles the star on a row whatever its status", () => {
		const tasks = [task({ id: "a", title: "Go", status: "done" })];
		const starred = applyDayTaskList(tasks, { type: "toggleTop3", id: "a" }, ctx);
		expect(starred[0].top3_for_date).toBe(TODAY);
		expect(
			applyDayTaskList(starred, { type: "toggleTop3", id: "a" }, ctx)[0].top3_for_date,
		).toBeNull();
	});
});

describe("applyDayIntent", () => {
	const ctx = { todayIso: TODAY, top3DateIso: TODAY, nowIso: `${TODAY}T15:00:00.000Z` };

	it("keeps a completed non-recurring task on its band (ADR-0038)", () => {
		const t = task({ id: "a", title: "Go", due_date: TODAY });
		const schedule = emptySchedule({
			open: [t],
			allDay: [{ kind: "task", key: "task:a", sortAt: TODAY, time: null, task: t }],
		});
		const next = applyDayIntent(schedule, { type: "complete", id: "a" }, ctx);
		expect(next.allDay).toHaveLength(1);
		expect(next.allDay[0]?.kind === "task" && next.allDay[0].task.status).toBe("done");
		expect(next.open[0]?.status).toBe("done");
	});

	it("drops a rolled recurring task from the day", () => {
		const t = task({
			id: "r",
			title: "Weekly",
			due_date: TODAY,
			recurrence_rule: "daily",
		});
		const schedule = emptySchedule({
			open: [t],
			allDay: [{ kind: "task", key: "task:r", sortAt: TODAY, time: null, task: t }],
		});
		const next = applyDayIntent(schedule, { type: "complete", id: "r" }, ctx);
		expect(next.allDay).toHaveLength(0);
		expect(next.open).toHaveLength(0);
	});

	it("moves a row into Top 3 when starred", () => {
		const t = task({ id: "a", title: "Go", due_date: TODAY });
		const schedule = emptySchedule({ open: [t] });
		const next = applyDayIntent(schedule, { type: "toggleTop3", id: "a" }, ctx);
		expect(next.top3.map((x) => x.id)).toEqual(["a"]);
		expect(next.open).toHaveLength(0);
	});
});
