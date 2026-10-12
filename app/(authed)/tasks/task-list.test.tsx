import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/action-result";
import { completeTaskAction } from "@/lib/actions/tasks";
import { toastError } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/schemas/task";
import { createDispatchStore, type DispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { NOW, snapshot, T1, T2, TODAY, TZ, task } from "@/lib/store/test-fixtures";
import type { StoreWrite } from "@/lib/store/types";
import { TaskList } from "./task-list";

// A "use server" module is plain async functions in a test; replace it.
vi.mock("@/lib/actions/tasks", () => ({
	completeTaskAction: vi.fn(),
	createTaskAction: vi.fn(),
	deleteTaskAction: vi.fn(),
	quickAddTaskAction: vi.fn(),
	reopenTaskAction: vi.fn(),
	setTop3Action: vi.fn(),
	updateTaskAction: vi.fn(),
}));
vi.mock("@/lib/client/toast", () => ({
	toastError: vi.fn(),
	toastNotice: vi.fn(),
	toastSuccess: vi.fn(),
}));

type Result = ActionResult<StoreWrite<TaskRow>>;

const milk = task({ id: "milk", title: "Buy milk" });
const milkDone = task({ id: "milk", title: "Buy milk", status: "done", completed_at: NOW });

let store: DispatchStore;
beforeEach(() => {
	store = createDispatchStore({ now: () => NOW });
});

function renderList() {
	const snap = snapshot(T1, [
		{ key: viewKey.tasks(), type: "taskLists", data: { open: [milk], done: [] } },
	]);
	return render(
		<StoreProvider store={store}>
			<Seed snapshot={snap}>
				<TaskList todayIso={TODAY} tz={TZ} domains={[]} />
			</Seed>
		</StoreProvider>,
	);
}

/** An action the test resolves by hand, so the optimistic state can be seen first. */
function deferred() {
	let resolve: (r: Result) => void = () => {};
	const promise = new Promise<Result>((r) => {
		resolve = r;
	});
	return { promise, resolve };
}

const completeBox = () => screen.queryByRole("checkbox", { name: 'Complete "Buy milk"' });
const reopenBox = () => screen.queryByRole("checkbox", { name: 'Reopen "Buy milk"' });

describe("TaskList on the entity store", () => {
	it("a tick shows at once and the server's row confirms it", async () => {
		const action = deferred();
		vi.mocked(completeTaskAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(completeBox() as HTMLElement);
		expect(reopenBox()).toBeInTheDocument();
		expect(completeTaskAction).toHaveBeenCalledWith({ id: "milk", observedDueDate: null });

		await act(async () => action.resolve({ ok: true, data: { at: T2, rows: [milkDone] } }));
		expect(reopenBox()).toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().rows.task.milk).toMatchObject({ row: milkDone, v: T2 });
	});

	it("a failed tick rolls back and says so", async () => {
		const action = deferred();
		vi.mocked(completeTaskAction).mockReturnValue(action.promise);
		const user = userEvent.setup();
		renderList();

		await user.click(completeBox() as HTMLElement);
		expect(reopenBox()).toBeInTheDocument();

		await act(async () => action.resolve({ ok: false, formError: "Task not found" }));
		expect(completeBox()).toBeInTheDocument();
		expect(store.getState().pending).toEqual([]);
		expect(toastError).toHaveBeenCalledWith("Task not found");
	});

	it("a stale seed does not undo a confirmed tick", async () => {
		vi.mocked(completeTaskAction).mockResolvedValue({
			ok: true,
			data: { at: T2, rows: [milkDone] },
		});
		const user = userEvent.setup();
		const { rerender } = renderList();
		await user.click(completeBox() as HTMLElement);
		await act(async () => {});

		// SoftRefresh or a cached page replay: newer than the page's seed, but it
		// began before the write committed, so the confirmed tick replays over it.
		const stale = snapshot("2026-07-15T12:01:30.000Z", [
			{ key: viewKey.tasks(), type: "taskLists", data: { open: [milk], done: [] } },
		]);
		rerender(
			<StoreProvider store={store}>
				<Seed snapshot={stale}>
					<TaskList todayIso={TODAY} tz={TZ} domains={[]} />
				</Seed>
			</StoreProvider>,
		);
		expect(reopenBox()).toBeInTheDocument();
	});
});
