import { describe, expect, it } from "vitest";
import { collectDayTasks } from "@/lib/day-schedule";
import { applyIntent, applySeed, confirmWrite, initialState, selectView } from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import {
	dayPayload,
	deepFreeze,
	NOW,
	snapshot,
	T1,
	T2,
	TODAY,
	task,
} from "@/lib/store/test-fixtures";

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
