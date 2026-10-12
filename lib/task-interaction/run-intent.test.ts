import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskRow } from "@/lib/schemas/task";
import type { TaskIntent } from "@/lib/task-interaction/apply-intent";

const toastSuccessMock = vi.fn();
const toastNoticeMock = vi.fn();

vi.mock("@/lib/client/toast", () => ({
	runAction: vi.fn(),
	toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
	toastNotice: (...args: unknown[]) => toastNoticeMock(...args),
}));

const { bindTaskHandlers, skipRecurringTask, toastTaskToggle } = await import("./run-intent");

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
		recurrence_day: null,
		series_id: null,
		top3_for_date: null,
		source: "manual",
		created_at: "2026-07-01T12:00:00.000Z",
		completed_at: null,
		domain: { id: "domain-1", name: "Engine", color: null },
		project: null,
		...partial,
	};
}

describe("toastTaskToggle", () => {
	beforeEach(() => {
		toastSuccessMock.mockClear();
		toastNoticeMock.mockClear();
	});

	it("toasts Done for a one-shot complete", () => {
		toastTaskToggle("complete", task({ id: "a", title: "Ship" }), TODAY);
		expect(toastSuccessMock).toHaveBeenCalledWith("Done");
	});

	it("toasts Done plus the next due phrase for a recurring complete", () => {
		toastTaskToggle(
			"complete",
			task({
				id: "r",
				title: "Weekly",
				recurrence_rule: "weekly",
				due_date: "2026-07-10",
			}),
			TODAY,
		);
		expect(toastSuccessMock).toHaveBeenCalledWith("Done", "Next due in 2d");
	});

	it("toasts Reopened as a neutral notice", () => {
		toastTaskToggle("reopen", task({ id: "a", title: "Ship", status: "done" }), TODAY);
		expect(toastNoticeMock).toHaveBeenCalledWith("Reopened");
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});
});

describe("bindTaskHandlers", () => {
	const actions = {
		complete: vi.fn(),
		reopen: vi.fn(),
		setTop3: vi.fn(),
		delete: vi.fn(),
	};

	beforeEach(() => {
		toastSuccessMock.mockClear();
		toastNoticeMock.mockClear();
		actions.complete.mockReset();
		actions.reopen.mockReset();
		actions.setTop3.mockReset();
		actions.delete.mockReset();
	});

	it("toasts on complete when the runner claims", () => {
		const run = vi.fn(() => true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, actions, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(toastSuccessMock).toHaveBeenCalledWith("Done");
	});

	it("does not toast when the runner refuses the claim", () => {
		const run = vi.fn(() => false);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, actions, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(toastNoticeMock).not.toHaveBeenCalled();
	});

	it("toasts Reopened on uncheck", () => {
		const run = vi.fn(() => true);
		const handlers = bindTaskHandlers(
			task({ id: "a", title: "Ship", status: "done" }),
			run,
			actions,
			{ top3DateIso: TODAY, todayIso: TODAY },
		);
		handlers.onToggleDone();
		expect(toastNoticeMock).toHaveBeenCalledWith("Reopened");
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});

	it("does not toast on star", () => {
		const run = vi.fn(() => true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, actions, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleTop3();
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(toastNoticeMock).not.toHaveBeenCalled();
	});

	it("does not toast on delete", () => {
		const run = vi.fn(() => true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, actions, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onDelete?.();
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(toastNoticeMock).not.toHaveBeenCalled();
	});

	it("passes a complete intent with the observed due date", () => {
		const run = vi.fn((_intent: TaskIntent, action: () => Promise<unknown>) => {
			void action();
			return true;
		});
		const row = task({ id: "r", title: "Weekly", due_date: "2026-07-10" });
		const handlers = bindTaskHandlers(row, run, actions, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(run).toHaveBeenCalledWith(
			{ type: "complete", id: "r", observedDueDate: "2026-07-10" },
			expect.any(Function),
		);
		expect(actions.complete).toHaveBeenCalledWith({ id: "r", observedDueDate: "2026-07-10" });
	});

	it("names the snapshot a recurring tick saves (docs/adr/0083)", () => {
		const run = vi.fn((_intent: TaskIntent, action: () => Promise<unknown>) => {
			void action();
			return true;
		});
		const row = task({
			id: "snap-r",
			title: "Weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		bindTaskHandlers(row, run, actions, { top3DateIso: TODAY, todayIso: TODAY }).onToggleDone();
		const intent = run.mock.calls[0]?.[0];
		expect(intent).toMatchObject({
			type: "complete",
			id: "snap-r",
			snapshotId: expect.any(String),
		});
		expect(actions.complete).toHaveBeenCalledWith({
			id: "snap-r",
			observedDueDate: "2026-07-10",
			snapshotId: intent?.type === "complete" ? intent.snapshotId : undefined,
		});
	});

	it("skips only an open recurring task, and toasts where it went", () => {
		const skip = vi.fn();
		const run = vi.fn((_intent: TaskIntent, action: () => Promise<unknown>) => {
			void action();
			return true;
		});
		skipRecurringTask(task({ id: "plain", title: "Ship" }), run, skip, TODAY);
		expect(run).not.toHaveBeenCalled();

		const row = task({
			id: "skip-r",
			title: "Weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		skipRecurringTask(row, run, skip, TODAY);
		expect(run).toHaveBeenCalledWith(
			{ type: "skip", id: "skip-r", observedDueDate: "2026-07-10" },
			expect.any(Function),
		);
		expect(skip).toHaveBeenCalledWith({ id: "skip-r", observedDueDate: "2026-07-10" });
		expect(toastSuccessMock).toHaveBeenCalledWith("Skipped", "Next due in 2d");
	});

	it("takes a fast second tick on a recurring row as the same click", () => {
		vi.useFakeTimers();
		try {
			const run = vi.fn(() => true);
			const opts = { top3DateIso: TODAY, todayIso: TODAY };
			const row = task({ id: "dbl", title: "Daily", due_date: TODAY, recurrence_rule: "daily" });
			bindTaskHandlers(row, run, actions, opts).onToggleDone();
			// The re-rendered row is on its next cycle, under the same cursor.
			const moved = { ...row, due_date: "2026-07-16" };
			bindTaskHandlers(moved, run, actions, opts).onToggleDone();
			expect(run).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(1000);
			bindTaskHandlers(moved, run, actions, opts).onToggleDone();
			expect(run).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
