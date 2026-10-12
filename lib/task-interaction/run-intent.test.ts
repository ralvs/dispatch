import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeTaskAction, skipTaskAction } from "@/lib/actions/tasks";
import type { TaskRow } from "@/lib/schemas/task";
import type { Write } from "@/lib/store/write";

const toastSuccessMock = vi.fn();
const toastNoticeMock = vi.fn();

vi.mock("@/lib/client/toast", () => ({
	runAction: vi.fn(),
	toastSuccess: (...args: unknown[]) => toastSuccessMock(...args),
	toastNotice: (...args: unknown[]) => toastNoticeMock(...args),
}));

vi.mock("@/lib/actions/tasks", () => ({
	assignDomainAction: vi.fn(),
	completeTaskAction: vi.fn(),
	createTaskAction: vi.fn(),
	deleteTaskAction: vi.fn(),
	quickAddTaskAction: vi.fn(),
	reopenTaskAction: vi.fn(),
	setTop3Action: vi.fn(),
	skipTaskAction: vi.fn(),
	updateTaskAction: vi.fn(),
}));

const CTX = { todayIso: "2026-07-15", tz: "America/Sao_Paulo", nowIso: "2026-07-15T12:00:00.000Z" };

/** A runner that claims (or refuses) and runs the server half with CTX. */
function writesThat(claims: boolean) {
	return {
		send: vi.fn((w: Write<"task">) => {
			if (claims) void w.call(CTX);
			return claims;
		}),
	};
}

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
	beforeEach(() => {
		toastSuccessMock.mockClear();
		toastNoticeMock.mockClear();
		vi.mocked(completeTaskAction).mockReset();
		vi.mocked(skipTaskAction).mockReset();
	});

	it("toasts on complete when the runner claims", () => {
		const run = writesThat(true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(toastSuccessMock).toHaveBeenCalledWith("Done");
	});

	it("does not toast when the runner refuses the claim", () => {
		const run = writesThat(false);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(toastNoticeMock).not.toHaveBeenCalled();
	});

	it("toasts Reopened on uncheck", () => {
		const run = writesThat(true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship", status: "done" }), run, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(toastNoticeMock).toHaveBeenCalledWith("Reopened");
		expect(toastSuccessMock).not.toHaveBeenCalled();
	});

	it("does not toast on star", () => {
		const run = writesThat(true);
		const handlers = bindTaskHandlers(task({ id: "a", title: "Ship" }), run, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleTop3();
		expect(toastSuccessMock).not.toHaveBeenCalled();
		expect(toastNoticeMock).not.toHaveBeenCalled();
	});

	it("passes a complete intent with the observed due date", () => {
		const run = writesThat(true);
		const row = task({ id: "r", title: "Weekly", due_date: "2026-07-10" });
		const handlers = bindTaskHandlers(row, run, {
			top3DateIso: TODAY,
			todayIso: TODAY,
		});
		handlers.onToggleDone();
		expect(run.send.mock.calls[0]?.[0].intent).toEqual({
			type: "complete",
			id: "r",
			observedDueDate: "2026-07-10",
		});
		// The server dates the tick from the day the store applied it with.
		expect(completeTaskAction).toHaveBeenCalledWith({
			id: "r",
			observedDueDate: "2026-07-10",
			todayIso: CTX.todayIso,
		});
	});

	it("names the snapshot a recurring tick saves (docs/adr/0083)", () => {
		const run = writesThat(true);
		const row = task({
			id: "snap-r",
			title: "Weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		bindTaskHandlers(row, run, { top3DateIso: TODAY, todayIso: TODAY }).onToggleDone();
		const intent = run.send.mock.calls[0]?.[0].intent;
		expect(intent).toMatchObject({
			type: "complete",
			id: "snap-r",
			snapshotId: expect.any(String),
		});
		expect(completeTaskAction).toHaveBeenCalledWith({
			id: "snap-r",
			observedDueDate: "2026-07-10",
			snapshotId: intent?.type === "complete" ? intent.snapshotId : undefined,
			todayIso: CTX.todayIso,
		});
	});

	it("skips only an open recurring task, and toasts where it went", () => {
		const run = writesThat(true);
		skipRecurringTask(task({ id: "plain", title: "Ship" }), run, TODAY);
		expect(run.send).not.toHaveBeenCalled();

		const row = task({
			id: "skip-r",
			title: "Weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		skipRecurringTask(row, run, TODAY);
		expect(run.send.mock.calls[0]?.[0].intent).toEqual({
			type: "skip",
			id: "skip-r",
			observedDueDate: "2026-07-10",
		});
		expect(skipTaskAction).toHaveBeenCalledWith({
			id: "skip-r",
			observedDueDate: "2026-07-10",
			todayIso: CTX.todayIso,
		});
		expect(toastSuccessMock).toHaveBeenCalledWith("Skipped", "Next due in 2d");
	});

	it("takes a fast second tick on a recurring row as the same click", () => {
		vi.useFakeTimers();
		try {
			const run = writesThat(true);
			const opts = { top3DateIso: TODAY, todayIso: TODAY };
			const row = task({ id: "dbl", title: "Daily", due_date: TODAY, recurrence_rule: "daily" });
			bindTaskHandlers(row, run, opts).onToggleDone();
			// The re-rendered row is on its next cycle, under the same cursor.
			const moved = { ...row, due_date: "2026-07-16" };
			bindTaskHandlers(moved, run, opts).onToggleDone();
			expect(run.send).toHaveBeenCalledTimes(1);
			vi.advanceTimersByTime(1000);
			bindTaskHandlers(moved, run, opts).onToggleDone();
			expect(run.send).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
