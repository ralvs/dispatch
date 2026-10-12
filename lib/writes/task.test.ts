import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeTaskAction, setTop3Action, skipTaskAction } from "@/lib/actions/tasks";
import type { IntentCtx } from "@/lib/store/types";
import { taskWrites } from "./task";

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

beforeEach(() => {
	vi.clearAllMocks();
});

// A tab that slept past midnight: the store applied the intent with yesterday.
const ctx: IntentCtx = {
	todayIso: "2026-07-14",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("taskWrites", () => {
	it("a tick sends the day the store applied it with", async () => {
		const w = taskWrites.complete({ id: "t1", observedDueDate: "2026-07-10", snapshotId: "s1" });
		expect(w.intent).toEqual({
			type: "complete",
			id: "t1",
			observedDueDate: "2026-07-10",
			snapshotId: "s1",
		});
		await w.call(ctx);
		expect(completeTaskAction).toHaveBeenCalledWith({
			id: "t1",
			observedDueDate: "2026-07-10",
			snapshotId: "s1",
			todayIso: "2026-07-14",
		});
	});

	it("a skip sends the day the store applied it with", async () => {
		const w = taskWrites.skip({ id: "t1", observedDueDate: null });
		expect(w.intent).toEqual({ type: "skip", id: "t1", observedDueDate: null });
		await w.call(ctx);
		expect(skipTaskAction).toHaveBeenCalledWith({
			id: "t1",
			observedDueDate: null,
			todayIso: "2026-07-14",
		});
	});

	it("a star pins the intent's own day", async () => {
		const i = { id: "t1", starred: true, forDateIso: "2026-07-16" };
		const w = taskWrites.setTop3(i);
		expect(w.intent).toEqual({ type: "setTop3", ...i });
		await w.call(ctx);
		expect(setTop3Action).toHaveBeenCalledWith(i);
	});
});
