import { describe, expect, it } from "vitest";
import { task } from "@/lib/store/test-fixtures";
import { nextCompleteFields, projectTask, snapshotOf } from "@/lib/task-interaction/apply-intent";

// Where a projected row then sits — which list, which band — is the task
// adapter's, and is tested through the store (lib/store/kinds/task.test.ts).

const TODAY = "2026-07-15";
const ctx = { todayIso: TODAY, nowIso: `${TODAY}T12:00:00.000Z` };

describe("nextCompleteFields", () => {
	it("names a recurring task's next occurrence", () => {
		const t = task({ id: "r", recurrence_rule: "weekly", due_date: "2026-07-10" });
		expect(nextCompleteFields(t, ctx)).toEqual({
			completed_at: ctx.nowIso,
			spawn: { due_date: "2026-07-17", recurrence_day: null },
		});
	});

	it("spawns nothing for a one-off task", () => {
		expect(nextCompleteFields(task({ id: "a" }), ctx)).toEqual({
			completed_at: ctx.nowIso,
			spawn: null,
		});
	});
});

describe("projectTask", () => {
	// docs/adr/0083: a recurring tick keeps the row open and moves it to its
	// next cycle; its star follows it there.
	it("moves a recurring task to its next cycle and keeps it open", () => {
		const t = task({ id: "r", recurrence_rule: "daily", due_date: TODAY, top3_for_date: TODAY });
		expect(projectTask(t, { type: "complete", id: "r", observedDueDate: TODAY }, ctx)).toEqual({
			...t,
			due_date: "2026-07-16",
			top3_for_date: "2026-07-16",
		});
	});

	it("leaves a recurring row alone when the tick saw another cycle", () => {
		const t = task({ id: "r", recurrence_rule: "daily", due_date: "2026-07-16" });
		expect(projectTask(t, { type: "complete", id: "r", observedDueDate: TODAY }, ctx)).toBe(t);
	});

	it("projects the done snapshot a recurring tick saves", () => {
		const t = task({ id: "r", recurrence_rule: "daily", due_date: TODAY, top3_for_date: TODAY });
		const tick = {
			type: "complete",
			id: "r",
			observedDueDate: TODAY,
			snapshotId: "snap",
		} as const;
		expect(snapshotOf(t, tick, ctx)).toEqual({
			...t,
			id: "snap",
			status: "done",
			completed_at: ctx.nowIso,
			created_at: ctx.nowIso,
			recurrence_rule: null,
			series_id: "r",
		});
		// No snapshot for a plain task, a stale tick, or a tick that named no id.
		expect(snapshotOf(task({ id: "r" }), tick, ctx)).toBeUndefined();
		expect(snapshotOf({ ...t, due_date: "2026-07-16" }, tick, ctx)).toBeUndefined();
		expect(snapshotOf(t, { ...tick, snapshotId: undefined }, ctx)).toBeUndefined();
	});

	it("skips a recurring task to its next cycle and leaves a plain task alone", () => {
		const t = task({ id: "r", recurrence_rule: "weekly", due_date: TODAY });
		const skip = { type: "skip", id: "r", observedDueDate: TODAY } as const;
		expect(projectTask(t, skip, ctx)).toMatchObject({ status: "open", due_date: "2026-07-22" });
		const plain = task({ id: "r", due_date: TODAY });
		expect(projectTask(plain, skip, ctx)).toBe(plain);
	});

	// The server's close is guarded on status = open; so is the projection, so
	// a second tick on a ticked row changes nothing.
	it("leaves a row that is already done alone", () => {
		const done = task({ id: "a", status: "done", completed_at: "2026-07-14T09:00:00.000Z" });
		const complete = { type: "complete", id: "a", observedDueDate: null } as const;
		expect(projectTask(done, complete, ctx)).toBe(done);
	});

	it("reopens a done row and leaves an open one alone", () => {
		const done = task({ id: "a", status: "done", completed_at: "2026-07-14T09:00:00.000Z" });
		expect(projectTask(done, { type: "reopen", id: "a" }, ctx)).toMatchObject({
			status: "open",
			completed_at: null,
		});
		const open = task({ id: "a" });
		expect(projectTask(open, { type: "reopen", id: "a" }, ctx)).toBe(open);
	});

	// Today's day navigation stars against the day on screen, so the patch pins
	// to that day, and an unstar clears only the day it names.
	it("sets the star as desired state for the day it names", () => {
		const t = task({ id: "t" });
		const other = "2026-07-31";
		const starred = projectTask(
			t,
			{ type: "setTop3", id: "t", starred: true, forDateIso: other },
			ctx,
		) as ReturnType<typeof task>;
		expect(starred.top3_for_date).toBe(other);
		const wrongDay = { type: "setTop3", id: "t", starred: false, forDateIso: TODAY } as const;
		expect(projectTask(starred, wrongDay, ctx)).toBe(starred);
		const unstar = { type: "setTop3", id: "t", starred: false, forDateIso: other } as const;
		expect(projectTask(starred, unstar, ctx)?.top3_for_date).toBeNull();
	});

	it("files, deletes, and passes every other row through", () => {
		const t = task({ id: "t", domain_id: null });
		expect(projectTask(t, { type: "assign", id: "t", domainId: "d2" }, ctx)?.domain_id).toBe("d2");
		expect(projectTask(t, { type: "delete", id: "t" }, ctx)).toBeUndefined();
		expect(projectTask(t, { type: "delete", id: "other" }, ctx)).toBe(t);
		expect(projectTask(t, { type: "edit", id: "t" }, ctx)).toBe(t);
	});
});
