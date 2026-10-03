import { describe, expect, it } from "vitest";
import { buildDaySchedule, collectDayTasks } from "@/lib/day-schedule";
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
	TZ,
	task,
} from "@/lib/store/test-fixtures";
import type { AggregateKey, Snapshot } from "@/lib/store/types";

const YESTERDAY = "2026-07-14";

describe("task adapter", () => {
	it("ADR-0038: a done row stays struck on today's view, leaves other cached days", () => {
		const a = task({ id: "a", due_date: YESTERDAY });
		const s = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [
					{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) },
					{ key: viewKey.day(YESTERDAY), type: "day", data: dayPayload(YESTERDAY, [a]) },
				]),
			),
		);
		const [next] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "a", observedDueDate: YESTERDAY } },
			NOW,
		);
		const today = selectView(next, viewKey.day(TODAY));
		expect(today?.schedule.open).toEqual([
			expect.objectContaining({ id: "a", status: "done", completed_at: NOW }),
		]);
		const yesterday = selectView(next, viewKey.day(YESTERDAY));
		expect(yesterday && collectDayTasks(yesterday.schedule)).toEqual([]);
	});

	it("ADR-0059: a recurring completion's successor is admitted by placement", () => {
		const a = task({ id: "a", due_date: TODAY, recurrence_rule: "daily" });
		const s = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [
					{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) },
					{ key: viewKey.tasks(), type: "taskLists", data: { open: [a], done: [] } },
				]),
			),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "a", observedDueDate: TODAY } },
			NOW,
		);
		const closed = task({ id: "a", due_date: TODAY, status: "done", completed_at: NOW });
		const successor = task({ id: "b", due_date: "2026-07-16", recurrence_rule: "daily" });
		const next = confirmWrite(deepFreeze(applied), token, { at: T2, rows: [closed, successor] });

		// Due tomorrow: offered to today's pool, but placement keeps it off the day.
		const today = selectView(next, viewKey.day(TODAY));
		expect(today && collectDayTasks(today.schedule).map((t) => t.id)).toEqual(["a"]);
		expect(selectView(next, viewKey.tasks())?.open.map((t) => t.id)).toEqual(["b"]);

		const tomorrow = applySeed(
			next,
			snapshot(T1, [
				{ key: viewKey.day("2026-07-16"), type: "day", data: dayPayload("2026-07-16") },
			]),
		);
		const day2 = selectView(tomorrow, viewKey.day("2026-07-16"));
		expect(day2 && collectDayTasks(day2.schedule).map((t) => t.id)).toEqual(["b"]);
	});

	it("one intent updates both taskLists and day", () => {
		const a = task({ id: "a", due_date: TODAY });
		const s = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [
					{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) },
					{ key: viewKey.tasks(), type: "taskLists", data: { open: [a], done: [] } },
				]),
			),
		);
		const [next] = applyIntent(
			s,
			{
				kind: "task",
				intent: { type: "setTop3", id: "a", starred: true, forDateIso: TODAY },
			},
			NOW,
		);
		expect(selectView(next, viewKey.tasks())?.open[0].top3_for_date).toBe(TODAY);
		expect(selectView(next, viewKey.day(TODAY))?.schedule.top3.map((t) => t.id)).toEqual(["a"]);
	});

	it("a create a seed already read is listed once", () => {
		const a = task({ id: "a", due_date: TODAY, project_id: "p1" });
		const s = applySeed(
			initialState(),
			snapshot(T1, [
				{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) },
				{ key: viewKey.tasks(), type: "taskLists", data: { open: [a], done: [] } },
				{
					key: viewKey.project("p1"),
					type: "taskList",
					data: { rows: [a], scope: { projectId: "p1" } },
				},
			]),
		);
		const [next] = applyIntent(s, { kind: "task", intent: { type: "create", task: a } }, NOW);
		const day = selectView(next, viewKey.day(TODAY));
		expect(day && collectDayTasks(day.schedule)).toEqual([a]);
		expect(selectView(next, viewKey.tasks())?.open).toEqual([a]);
		expect(selectView(next, viewKey.project("p1"))).toEqual([a]);
	});

	it("a flat list admits only rows in its scope", () => {
		const s = deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [
					{
						key: viewKey.project("p1"),
						type: "taskList",
						data: { rows: [], scope: { projectId: "p1" } },
					},
					{ key: viewKey.inbox(), type: "taskList", data: { rows: [] } },
				]),
			),
		);
		const [next] = applyIntent(
			s,
			{ kind: "task", intent: { type: "create", task: task({ id: "t", project_id: "p1" }) } },
			NOW,
		);
		expect(selectView(next, viewKey.project("p1"))?.map((t) => t.id)).toEqual(["t"]);
		expect(selectView(next, viewKey.inbox())).toEqual([]);
	});
});

describe("/tasks lists", () => {
	const seed = (open: ReturnType<typeof task>[], done: ReturnType<typeof task>[] = []) =>
		deepFreeze(
			applySeed(
				initialState(),
				snapshot(T1, [{ key: viewKey.tasks(), type: "taskLists", data: { open, done } }]),
			),
		);

	it("a tick moves the row to the top of done and drops its star; an untick brings it back", () => {
		const s = seed(
			[task({ id: "a", top3_for_date: TODAY }), task({ id: "b" })],
			[task({ id: "old", status: "done" })],
		);
		const [ticked] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "a", observedDueDate: null } },
			NOW,
		);
		const lists = selectView(ticked, viewKey.tasks());
		expect(lists?.open.map((t) => t.id)).toEqual(["b"]);
		expect(lists?.done.map((t) => t.id)).toEqual(["a", "old"]);
		expect(lists?.done[0]).toMatchObject({
			status: "done",
			completed_at: NOW,
			top3_for_date: null,
		});

		const [unticked] = applyIntent(
			ticked,
			{ kind: "task", intent: { type: "reopen", id: "a" } },
			NOW,
		);
		const back = selectView(unticked, viewKey.tasks());
		expect(back?.open.map((t) => t.id)).toEqual(["a", "b"]);
		expect(back?.done.map((t) => t.id)).toEqual(["old"]);
	});

	it("a second tick on a ticked row changes nothing", () => {
		const s = seed([task({ id: "a" })]);
		const complete = { type: "complete", id: "a", observedDueDate: null } as const;
		const [once] = applyIntent(s, { kind: "task", intent: complete }, NOW);
		const [twice] = applyIntent(once, { kind: "task", intent: complete }, T3);
		expect(selectView(twice, viewKey.tasks())).toEqual(selectView(once, viewKey.tasks()));
	});
});

describe("Today's bands", () => {
	it("a tick keeps a starred row in Top 3, struck (ADR-0038)", () => {
		const a = task({ id: "a", top3_for_date: TODAY });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) }]),
		);
		const [next] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "a", observedDueDate: null } },
			NOW,
		);
		expect(selectView(next, viewKey.day(TODAY))?.schedule.top3).toEqual([
			expect.objectContaining({ id: "a", status: "done", top3_for_date: TODAY }),
		]);
	});

	it("starring one of the open band's ten backfills it from the overflow", () => {
		const late = Array.from({ length: 12 }, (_, i) => task({ id: `t${i}`, due_date: YESTERDAY }));
		const schedule = buildDaySchedule({ events: [], openTasks: late, dateIso: TODAY, tz: TZ });
		const s = applySeed(
			initialState(),
			snapshot(T1, [
				{ key: viewKey.day(TODAY), type: "day", data: { ...dayPayload(TODAY), schedule } },
			]),
		);
		const [next] = applyIntent(
			s,
			{ kind: "task", intent: { type: "setTop3", id: "t0", starred: true, forDateIso: TODAY } },
			NOW,
		);
		const day = selectView(next, viewKey.day(TODAY));
		expect(day?.schedule.top3.map((t) => t.id)).toEqual(["t0"]);
		expect(day?.schedule.open.map((t) => t.id)).toEqual(late.slice(1, 11).map((t) => t.id));
	});
});

describe("inbox scope", () => {
	it("admits an unfiled create on confirm, not a filed one", () => {
		const s = applySeed(
			initialState(),
			snapshot(T1, [
				{
					key: viewKey.inbox(),
					type: "taskList",
					data: { rows: [], scope: { unfiled: true, status: "open" } },
				},
			]),
		);
		const unfiled = task({ id: "u", domain_id: null });
		const filed = task({ id: "f", domain_id: "domain-1" });
		const [a1, t1] = applyIntent(
			s,
			{ kind: "task", intent: { type: "create", task: unfiled } },
			NOW,
		);
		const [a2, t2] = applyIntent(
			a1,
			{ kind: "task", intent: { type: "create", task: filed } },
			NOW,
		);
		// Optimistic: the pending unfiled create shows at once; the filed one never does.
		expect(selectView(a1, viewKey.inbox())?.map((r) => r.id)).toEqual(["u"]);
		expect(selectView(a2, viewKey.inbox())?.map((r) => r.id)).toEqual(["u"]);
		const c1 = confirmWrite(a2, t1, { at: T2, rows: [unfiled] });
		const c2 = confirmWrite(c1, t2, { at: T2, rows: [filed] });
		expect(selectView(c2, viewKey.inbox())?.map((r) => r.id)).toEqual(["u"]);
	});
});

const INBOX = {
	key: viewKey.inbox(),
	type: "taskList" as const,
	data: {
		rows: [] as ReturnType<typeof task>[],
		scope: { unfiled: true as const, status: "open" as const },
	},
};

describe("filing and editing", () => {
	it("an assign leaves the inbox at once, and stays gone once confirmed", () => {
		const u = task({ id: "u", domain_id: null });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ ...INBOX, data: { ...INBOX.data, rows: [u] } }]),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "assign", id: "u", domainId: "domain-2" } },
			NOW,
		);
		expect(selectView(applied, viewKey.inbox())).toEqual([]);
		const filed = task({ id: "u", domain_id: "domain-2" });
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [filed] });
		expect(selectView(confirmed, viewKey.inbox())).toEqual([]);
		// A stale seed read before the filing cannot bring it back.
		const stale = applySeed(
			confirmed,
			snapshot(T0, [{ ...INBOX, data: { ...INBOX.data, rows: [u] } }]),
		);
		expect(selectView(stale, viewKey.inbox())).toEqual([]);
	});

	it("a failed assign puts the row back", () => {
		const u = task({ id: "u", domain_id: null });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ ...INBOX, data: { ...INBOX.data, rows: [u] } }]),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "assign", id: "u", domainId: "domain-2" } },
			NOW,
		);
		expect(selectView(rollbackWrite(applied, token), viewKey.inbox())).toEqual([u]);
	});

	it("an edit projects nothing, then takes the server's row; a row moved out of a project leaves it", () => {
		const a = task({ id: "a", project_id: "p1", title: "Old" });
		const s = applySeed(
			initialState(),
			snapshot(T1, [
				{ key: viewKey.tasks(), type: "taskLists", data: { open: [a], done: [] } },
				{
					key: viewKey.project("p1"),
					type: "taskList",
					data: { rows: [a], scope: { projectId: "p1" } },
				},
			]),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "edit", id: "a" } },
			NOW,
		);
		expect(selectView(applied, viewKey.tasks())?.open).toEqual([a]);
		const edited = task({ id: "a", project_id: "p2", title: "New" });
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [edited] });
		expect(selectView(confirmed, viewKey.tasks())?.open).toEqual([edited]);
		expect(selectView(confirmed, viewKey.project("p1"))).toEqual([]);
	});
});

describe("Today's task counters", () => {
	const counts = (open: number, overdue: number, inbox: number): Snapshot["aggregates"] => ({
		"tasks.open": open,
		"tasks.overdue": overdue,
		"tasks.inbox": inbox,
	});
	const read = (s: ReturnType<typeof initialState>) =>
		(["tasks.open", "tasks.overdue", "tasks.inbox"] as AggregateKey[]).map((k) =>
			selectAggregate(s, k),
		);

	it("a tick on an overdue task moves open and overdue, and holds after confirm", () => {
		const late = task({ id: "late", due_date: YESTERDAY });
		const s = applySeed(
			initialState(),
			snapshot(
				T1,
				[{ key: viewKey.tasks(), type: "taskLists", data: { open: [late], done: [] } }],
				{ aggregates: counts(4, 1, 0) },
			),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "late", observedDueDate: YESTERDAY } },
			NOW,
		);
		expect(read(applied)).toEqual([3, 0, 0]);
		const done = task({ id: "late", due_date: YESTERDAY, status: "done", completed_at: NOW });
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [done] });
		expect(read(confirmed)).toEqual([3, 0, 0]);
		// A later read already counts the write: nothing is added twice.
		expect(read(applySeed(confirmed, snapshot(T3, [], { aggregates: counts(3, 0, 0) })))).toEqual([
			3, 0, 0,
		]);
		// A read that started before the write never undoes it.
		expect(read(applySeed(confirmed, snapshot(T0, [], { aggregates: counts(4, 1, 0) })))).toEqual([
			3, 0, 0,
		]);
	});

	it("a recurring tick keeps the open count: the successor replaces it", () => {
		const r = task({ id: "r", due_date: YESTERDAY, recurrence_rule: "daily" });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ key: viewKey.tasks(), type: "taskLists", data: { open: [r], done: [] } }], {
				aggregates: counts(2, 1, 0),
			}),
		);
		const [applied] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "r", observedDueDate: YESTERDAY } },
			NOW,
		);
		expect(read(applied)).toEqual([2, 0, 0]);
	});

	it("filing moves the inbox count; creating an unfiled task raises open and inbox", () => {
		const u = task({ id: "u", domain_id: null });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ ...INBOX, data: { ...INBOX.data, rows: [u] } }], {
				aggregates: counts(1, 0, 1),
			}),
		);
		const [filed] = applyIntent(
			s,
			{ kind: "task", intent: { type: "assign", id: "u", domainId: "domain-2" } },
			NOW,
		);
		expect(read(filed)).toEqual([1, 0, 0]);
		const [created] = applyIntent(
			s,
			{ kind: "task", intent: { type: "create", task: task({ id: "n", domain_id: null }) } },
			NOW,
		);
		expect(read(created)).toEqual([2, 0, 2]);
	});

	// Each intent counts from the row as the user sees it — pending intents
	// folded on — so a quick tick and untick, or a double tick, move a count
	// once, before and after the server answers.
	it("a tick then an untick before either answers leaves the counts as they were", () => {
		const late = task({ id: "late", due_date: YESTERDAY, project_id: "p1" });
		const s = applySeed(
			initialState(),
			snapshot(
				T1,
				[{ key: viewKey.tasks(), type: "taskLists", data: { open: [late], done: [] } }],
				{ aggregates: { ...counts(4, 1, 0), "project.open:p1": 1, "project.done:p1": 0 } },
			),
		);
		const [ticked, t1] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "late", observedDueDate: YESTERDAY } },
			NOW,
		);
		const [unticked, t2] = applyIntent(
			ticked,
			{ kind: "task", intent: { type: "reopen", id: "late" } },
			NOW,
		);
		const project = (st: typeof s) =>
			(["project.open:p1", "project.done:p1"] as AggregateKey[]).map((k) => selectAggregate(st, k));
		expect(read(unticked)).toEqual([4, 1, 0]);
		expect(project(unticked)).toEqual([1, 0]);

		const done = task({ ...late, status: "done", completed_at: NOW });
		const c1 = confirmWrite(unticked, t1, { at: T2, rows: [done] });
		const c2 = confirmWrite(c1, t2, { at: T3, rows: [late] });
		expect(read(c2)).toEqual([4, 1, 0]);
		expect(project(c2)).toEqual([1, 0]);
	});

	it("a double tick moves the counts once", () => {
		const late = task({ id: "late", due_date: YESTERDAY });
		const s = applySeed(
			initialState(),
			snapshot(
				T1,
				[{ key: viewKey.tasks(), type: "taskLists", data: { open: [late], done: [] } }],
				{ aggregates: counts(4, 1, 0) },
			),
		);
		const complete = { type: "complete", id: "late", observedDueDate: YESTERDAY } as const;
		const [once, t1] = applyIntent(s, { kind: "task", intent: complete }, NOW);
		const [twice, t2] = applyIntent(once, { kind: "task", intent: complete }, NOW);
		expect(read(twice)).toEqual([3, 0, 0]);
		// The replay finds the row closed and writes nothing; the server answers done both times.
		const done = task({ id: "late", due_date: YESTERDAY, status: "done", completed_at: NOW });
		const c1 = confirmWrite(twice, t1, { at: T2, rows: [done] });
		const c2 = confirmWrite(c1, t2, { at: T3, rows: [done] });
		expect(read(c2)).toEqual([3, 0, 0]);
	});

	it("a delete then another intent on the same row, before either answers, moves the counts once", () => {
		const late = task({ id: "late", due_date: YESTERDAY });
		const s = applySeed(
			initialState(),
			snapshot(
				T1,
				[{ key: viewKey.tasks(), type: "taskLists", data: { open: [late], done: [] } }],
				{ aggregates: counts(4, 1, 0) },
			),
		);
		const del = { kind: "task", intent: { type: "delete", id: "late" } } as const;
		const [once, t1] = applyIntent(s, del, NOW);
		const [twice, t2] = applyIntent(once, del, NOW);
		expect(read(twice)).toEqual([3, 0, 0]);
		const c1 = confirmWrite(twice, t1, { at: T2, rows: [], deletedIds: ["late"] });
		const c2 = confirmWrite(c1, t2, { at: T3, rows: [], deletedIds: ["late"] });
		expect(read(c2)).toEqual([3, 0, 0]);

		const [ticked] = applyIntent(
			once,
			{ kind: "task", intent: { type: "complete", id: "late", observedDueDate: YESTERDAY } },
			NOW,
		);
		expect(read(ticked)).toEqual([3, 0, 0]);
	});

	it("a row the store never loaded moves nothing", () => {
		const s = applySeed(initialState(), snapshot(T1, [], { aggregates: counts(1, 0, 0) }));
		const [applied] = applyIntent(s, { kind: "task", intent: { type: "delete", id: "x" } }, NOW);
		expect(read(applied)).toEqual([1, 0, 0]);
	});
});

describe("quiet tasks (docs/adr/0058)", () => {
	// p-quiet is paused: an undated task in it is quiet, and Today neither
	// counts it nor shows it.
	const quiet = task({ id: "q", project_id: "p-quiet" });
	const seed = (extra: Partial<Snapshot> = {}) =>
		applySeed(
			initialState(),
			snapshot(
				T1,
				[
					{ key: viewKey.tasks(), type: "taskLists", data: { open: [quiet], done: [] } },
					{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY) },
				],
				{
					quietProjectIds: ["p-quiet"],
					aggregates: { "tasks.open": 3, "tasks.overdue": 0, "tasks.inbox": 0 },
					...extra,
				},
			),
		);

	it("a tick on a quiet task moves none of Today's counters", () => {
		const [applied] = applyIntent(
			seed(),
			{ kind: "task", intent: { type: "complete", id: "q", observedDueDate: null } },
			NOW,
		);
		expect(selectAggregate(applied, "tasks.open")).toBe(3);
	});

	it("a quiet task starred on /tasks never lands on Today", () => {
		const star = { type: "setTop3", id: "q", starred: true, forDateIso: TODAY } as const;
		const [applied, token] = applyIntent(seed(), { kind: "task", intent: star }, NOW);
		const starred = { ...quiet, top3_for_date: TODAY };
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [starred] });
		const day = selectView(confirmed, viewKey.day(TODAY));
		expect(day && collectDayTasks(day.schedule)).toEqual([]);
	});

	it("a task that goes quiet leaves the day it was on", () => {
		const a = task({ id: "a", project_id: "p-quiet", due_date: TODAY });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) }], {
				quietProjectIds: ["p-quiet"],
			}),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "edit", id: "a" } },
			NOW,
		);
		const undated = { ...a, due_date: null };
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [undated] });
		const day = selectView(confirmed, viewKey.day(TODAY));
		expect(day && collectDayTasks(day.schedule)).toEqual([]);
	});

	// The server's day reads every task finished on it, quiet or not
	// (listCompletedOn), so the store keeps it there too — on confirm and on
	// a replay onto a seed that already holds it.
	it("a quiet task finished today stays on Today, struck", () => {
		const a = task({ id: "a", project_id: "p-quiet", top3_for_date: TODAY });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [a]) }], {
				quietProjectIds: ["p-quiet"],
			}),
		);
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "a", observedDueDate: null } },
			NOW,
		);
		const done = { ...a, status: "done" as const, completed_at: NOW };
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [done] });
		const day = selectView(confirmed, viewKey.day(TODAY));
		expect(day?.schedule.top3).toEqual([done]);

		const replayed = applySeed(
			confirmed,
			snapshot(
				"2026-07-15T12:01:30.000Z",
				[{ key: viewKey.day(TODAY), type: "day", data: dayPayload(TODAY, [done]) }],
				{ quietProjectIds: ["p-quiet"] },
			),
		);
		expect(selectView(replayed, viewKey.day(TODAY))?.schedule.top3).toEqual([done]);

		// Unticked, it is open and quiet again: the day no longer reads it.
		const [unticked] = applyIntent(
			replayed,
			{ kind: "task", intent: { type: "reopen", id: "a" } },
			NOW,
		);
		const day2 = selectView(unticked, viewKey.day(TODAY));
		expect(day2 && collectDayTasks(day2.schedule)).toEqual([]);
	});

	it("an older seed's quiet projects never land on a newer clock", () => {
		const s = applySeed(initialState(), snapshot(T3, [], { quietProjectIds: [] }));
		const stale = applySeed(s, snapshot(T1, [], { quietProjectIds: ["p-quiet"] }));
		expect(stale.clock?.quietProjectIds).toEqual([]);
		// Nor on a newer clock that holds none: the status may have changed since.
		const bare = applySeed(initialState(), snapshot(T3, []));
		expect(applySeed(bare, snapshot(T1, [], { quietProjectIds: ["p-quiet"] })).clock).toEqual(
			bare.clock,
		);
		const fresher = applySeed(stale, snapshot(T4, [], { quietProjectIds: ["p-quiet"] }));
		expect(fresher.clock?.quietProjectIds).toEqual(["p-quiet"]);
	});

	// The server counts the next occurrence: it is dated, so never quiet.
	it("a dated repeating task in a quiet project keeps the open count when ticked", () => {
		const r = task({ id: "r", project_id: "p-quiet", due_date: TODAY, recurrence_rule: "daily" });
		const s = applySeed(
			initialState(),
			snapshot(T1, [{ key: viewKey.tasks(), type: "taskLists", data: { open: [r], done: [] } }], {
				quietProjectIds: ["p-quiet"],
				aggregates: { "tasks.open": 3 },
			}),
		);
		const [ticked] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "r", observedDueDate: TODAY } },
			NOW,
		);
		expect(selectAggregate(ticked, "tasks.open")).toBe(3);
	});

	it("a seed that carries no quiet projects keeps the ones already known", () => {
		const later = applySeed(seed(), snapshot(T3, []));
		const [applied] = applyIntent(
			later,
			{ kind: "task", intent: { type: "complete", id: "q", observedDueDate: null } },
			NOW,
		);
		expect(later.clock?.quietProjectIds).toEqual(["p-quiet"]);
		expect(selectAggregate(applied, "tasks.open")).toBe(3);
	});
});

describe("a completion the server refused (ADR-0037)", () => {
	const late = task({ id: "late", due_date: YESTERDAY });
	const seedAt = (readAt: string) =>
		snapshot(
			readAt,
			[{ key: viewKey.tasks(), type: "taskLists", data: { open: [late], done: [] } }],
			{ aggregates: { "tasks.open": 1, "tasks.overdue": 1, "tasks.inbox": 0 } },
		);

	it("comes back open: the row returns to the open list and the counters move back", () => {
		const s = applySeed(initialState(), seedAt(T1));
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "late", observedDueDate: "2026-07-01" } },
			NOW,
		);
		expect(selectView(applied, viewKey.tasks())?.open).toEqual([]);
		// The row moved on since it was seen: still open, with another due date.
		const moved = task({ id: "late", due_date: TODAY });
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [moved] });
		expect(selectView(confirmed, viewKey.tasks())).toEqual({ open: [moved], done: [] });
		expect(selectAggregate(confirmed, "tasks.open")).toBe(1);
		expect(selectAggregate(confirmed, "tasks.overdue")).toBe(1);

		// A seed read between the view's and the write's replays the same answer.
		const replayed = applySeed(confirmed, seedAt("2026-07-15T12:01:30.000Z"));
		expect(selectView(replayed, viewKey.tasks())).toEqual({ open: [moved], done: [] });
		expect(selectAggregate(replayed, "tasks.open")).toBe(1);
	});

	it("gone: a deleted row's tombstone drops it everywhere", () => {
		const s = applySeed(initialState(), seedAt(T1));
		const [applied, token] = applyIntent(
			s,
			{ kind: "task", intent: { type: "complete", id: "late", observedDueDate: YESTERDAY } },
			NOW,
		);
		const confirmed = confirmWrite(applied, token, { at: T2, rows: [], deletedIds: ["late"] });
		expect(selectView(confirmed, viewKey.tasks())).toEqual({ open: [], done: [] });
		expect(selectAggregate(confirmed, "tasks.open")).toBe(0);
	});
});
