import { describe, expect, it } from "vitest";
import {
	type CountCtx,
	type CountedTask,
	change,
	countByProject,
	countOf,
	isRoutineDoneOn,
	noteCounts,
	openWorkCounts,
	plus,
	projectCounters,
	projectCounts,
	routinesDoneOn,
	tally,
	taskCounts,
} from "@/lib/counts";

const ctx: CountCtx = { todayIso: "2026-10-12", quietProjectIds: new Set(["paused"]) };

function task(partial: Partial<CountedTask> = {}): CountedTask {
	return { status: "open", due_date: null, project_id: null, domain_id: "d1", ...partial };
}

describe("openWorkCounts", () => {
	it("counts an open filed task as open and in its domain", () => {
		expect(openWorkCounts(task(), ctx)).toEqual({ "tasks.open": 1, "domain.open:d1": 1 });
	});

	it("counts an unfiled task in the inbox, not in a domain", () => {
		expect(openWorkCounts(task({ domain_id: null }), ctx)).toEqual({
			"tasks.open": 1,
			"tasks.inbox": 1,
		});
	});

	it("counts a task due before today as overdue, and one due today as not", () => {
		expect(countOf(openWorkCounts(task({ due_date: "2026-10-11" }), ctx), "tasks.overdue")).toBe(1);
		expect(countOf(openWorkCounts(task({ due_date: "2026-10-12" }), ctx), "tasks.overdue")).toBe(0);
	});

	it("counts nothing for a done task, a quiet task, or no task", () => {
		expect(openWorkCounts(task({ status: "done" }), ctx)).toEqual({});
		expect(openWorkCounts(task({ project_id: "paused" }), ctx)).toEqual({});
		expect(openWorkCounts(undefined, ctx)).toEqual({});
	});

	it("counts a dated task in a quiet project: a due date always wins", () => {
		expect(
			countOf(
				openWorkCounts(task({ project_id: "paused", due_date: "2026-10-20" }), ctx),
				"tasks.open",
			),
		).toBe(1);
	});
});

describe("projectCounts", () => {
	it("counts a task in its project's done or open count", () => {
		expect(projectCounts(task({ project_id: "p1" }))).toEqual({ "project.open:p1": 1 });
		expect(projectCounts(task({ project_id: "p1", status: "done" }))).toEqual({
			"project.done:p1": 1,
		});
	});

	it("counts a quiet task too: a project shows itself whole", () => {
		expect(projectCounts(task({ project_id: "paused" }))).toEqual({ "project.open:paused": 1 });
	});

	it("counts nothing for a task with no project", () => {
		expect(projectCounts(task())).toEqual({});
	});
});

describe("taskCounts", () => {
	it("is open work and the project's count together", () => {
		expect(taskCounts(task({ project_id: "p1", domain_id: null }), ctx)).toEqual({
			"tasks.open": 1,
			"tasks.inbox": 1,
			"project.open:p1": 1,
		});
	});
});

describe("noteCounts", () => {
	it("counts a flagged note for review, and nothing else", () => {
		expect(noteCounts({ needs_review: true })).toEqual({ "notes.needsReview": 1 });
		expect(noteCounts({ needs_review: false })).toEqual({});
		expect(noteCounts(undefined)).toEqual({});
	});
});

describe("routines done", () => {
	it("is done on a day with a completion that day", () => {
		expect(isRoutineDoneOn(["2026-10-11", "2026-10-12"], "2026-10-12")).toBe(true);
		expect(isRoutineDoneOn(["2026-10-11"], "2026-10-12")).toBe(false);
	});

	it("counts the routines done on the day", () => {
		const routines = [
			{ completions: ["2026-10-12"] },
			{ completions: [] },
			{ completions: ["2026-10-12"] },
		];
		expect(routinesDoneOn(routines, "2026-10-12")).toBe(2);
	});
});

describe("arithmetic", () => {
	it("tally sums what each row adds", () => {
		const rows = [
			task(),
			task({ domain_id: null }),
			task({ due_date: "2026-10-01" }),
			task({ status: "done" }),
		];
		expect(tally(rows, (t) => openWorkCounts(t, ctx))).toEqual({
			"tasks.open": 3,
			"tasks.overdue": 1,
			"tasks.inbox": 1,
			"domain.open:d1": 2,
		});
	});

	it("change is after minus before, zeros dropped", () => {
		const before = taskCounts(task({ project_id: "p1" }), ctx);
		const after = taskCounts(task({ project_id: "p1", status: "done" }), ctx);
		expect(change(before, after)).toEqual({
			"tasks.open": -1,
			"domain.open:d1": -1,
			"project.open:p1": -1,
			"project.done:p1": 1,
		});
		expect(change(before, before)).toEqual({});
	});

	it("plus drops a key that sums to zero", () => {
		expect(plus({ "tasks.open": 1 }, { "tasks.open": -1, "tasks.inbox": 1 })).toEqual({
			"tasks.inbox": 1,
		});
	});
});

describe("per project", () => {
	it("countByProject is projectCounts summed per project", () => {
		const rows = [
			task({ project_id: "p1" }),
			task({ project_id: "p1", status: "done" }),
			task({ project_id: "p1", status: "done" }),
			task({ project_id: "p2" }),
			task(),
		];
		expect(countByProject(rows)).toEqual({ p1: { done: 2, open: 1 }, p2: { done: 0, open: 1 } });
	});

	it("projectCounters names both counters, zeros included", () => {
		expect(projectCounters({ p1: { done: 0, open: 0 }, p2: { done: 3, open: 1 } })).toEqual({
			"project.done:p1": 0,
			"project.open:p1": 0,
			"project.done:p2": 3,
			"project.open:p2": 1,
		});
	});
});
