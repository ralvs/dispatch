import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskAction, quickAddTaskAction, updateTaskAction } from "@/lib/actions/tasks";
import { selectView } from "@/lib/store/core";
import { createDispatchStore } from "@/lib/store/create-store";
import { viewKey } from "@/lib/store/keys";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { snapshot, T1, task } from "@/lib/store/test-fixtures";
import { TaskDialog, type TaskDialogMode } from "./task-dialog";

// A "use server" module is plain async functions in a test; replace it.
vi.mock("@/lib/actions/tasks", () => ({
	createTaskAction: vi.fn(),
	quickAddTaskAction: vi.fn(),
	updateTaskAction: vi.fn(),
}));

const DOMAINS = [{ id: "7f1c0a4e-1111-4000-8000-000000000001", name: "Home", color: null }];
const HOME = DOMAINS[0].id;
const OLD = task({ id: "a", title: "Old", domain_id: HOME });
const SEED = snapshot(T1, [
	{ key: viewKey.tasks(), type: "taskLists", data: { open: [OLD], done: [] } },
]);
const AT = "2026-09-30T12:00:00.000Z";
const openTasks = () => selectView(store.getState(), viewKey.tasks())?.open ?? [];

let store: ReturnType<typeof createDispatchStore>;
beforeEach(() => {
	store = createDispatchStore();
});

function Harness({
	onClose = () => {},
	mode = "create",
	quickAdd = false,
}: {
	onClose?: () => void;
	mode?: TaskDialogMode;
	quickAdd?: boolean;
}) {
	const [open, setOpen] = useState(true);
	// Every write goes through the entity store, which every page that opens
	// the dialog seeds.
	return (
		<StoreProvider store={store}>
			<Seed snapshot={SEED}>
				<TaskDialog
					open={open}
					onClose={() => {
						setOpen(false);
						onClose();
					}}
					mode={mode}
					domains={DOMAINS}
					todayIso="2026-09-22"
					quickAdd={quickAdd}
					{...(mode === "edit"
						? { taskId: OLD.id, defaults: { title: OLD.title, domain_id: HOME } }
						: {})}
				/>
			</Seed>
		</StoreProvider>
	);
}

describe("TaskDialog", () => {
	beforeEach(() => {
		vi.mocked(createTaskAction).mockReset();
		vi.mocked(quickAddTaskAction).mockReset();
		vi.mocked(updateTaskAction).mockReset();
	});

	it("shows a rejected field under it and keeps the title", async () => {
		vi.mocked(createTaskAction).mockResolvedValue({
			ok: false,
			fieldErrors: { domain_id: ["Pick a domain."] },
			values: { title: "Buy milk" },
		});
		const user = userEvent.setup();
		render(<Harness />);
		await user.type(screen.getByLabelText("Task title"), "Buy milk");
		await user.click(screen.getByRole("button", { name: "Add task" }));

		expect(await screen.findByText("Pick a domain.")).toBeInTheDocument();
		const domain = screen.getByLabelText("Domain");
		expect(domain).toHaveAttribute("aria-invalid", "true");
		expect(domain).toHaveAccessibleDescription("Pick a domain.");
		await waitFor(() => expect(domain).toHaveFocus());
		expect(screen.getByLabelText("Task title")).toHaveValue("Buy milk");
		expect(screen.getByRole("dialog")).toBeInTheDocument();
		// The rejected create leaves no row behind.
		expect(store.getState().pending).toEqual([]);
		expect(openTasks()).toEqual([OLD]);
	});

	it("shows a rejected title under the title", async () => {
		vi.mocked(createTaskAction).mockResolvedValue({
			ok: false,
			fieldErrors: { title: ["Give the task a title."] },
		});
		const user = userEvent.setup();
		render(<Harness />);
		await user.type(screen.getByLabelText("Task title"), " x");
		await user.click(screen.getByRole("button", { name: "Add task" }));

		const title = screen.getByLabelText("Task title");
		expect(await screen.findByText("Give the task a title.")).toBeInTheDocument();
		expect(title).toHaveAttribute("aria-invalid", "true");
		expect(title).toHaveAccessibleDescription("Give the task a title.");
	});

	it("writes the create through the store, and closes on success", async () => {
		let answer: (value: Awaited<ReturnType<typeof createTaskAction>>) => void = () => {};
		vi.mocked(createTaskAction).mockReturnValue(new Promise((resolve) => (answer = resolve)));
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(<Harness onClose={onClose} />);
		await user.type(screen.getByLabelText("Task title"), "Buy milk");
		await user.click(screen.getByRole("button", { name: "Add task" }));

		// The create is in the store before the server answers…
		await waitFor(() => expect(store.getState().pending).toHaveLength(1));
		expect(store.getState().pending[0]).toMatchObject({
			kind: "task",
			intent: { type: "create", task: { title: "Buy milk" } },
		});
		expect(openTasks().map((t) => t.title)).toEqual(["Buy milk", "Old"]);
		const saved = task({ id: "srv", title: "Buy milk", domain_id: HOME });
		answer({ ok: true, data: { at: AT, rows: [saved] } });

		// …and the server's row takes the stand-in's place once it does.
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(store.getState().pending).toEqual([]);
		expect(openTasks()).toEqual([saved, OLD]);
		expect(quickAddTaskAction).not.toHaveBeenCalled();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("with quickAdd, sends a bare title to the parser through the store", async () => {
		const parsed = task({ id: "srv", title: "Buy milk", due_date: "2026-09-23" });
		vi.mocked(quickAddTaskAction).mockResolvedValue({ ok: true, data: { at: AT, rows: [parsed] } });
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(<Harness quickAdd onClose={onClose} />);
		await user.type(screen.getByLabelText("Task title"), "Buy milk tomorrow");
		await user.click(screen.getByRole("button", { name: "Add task" }));

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(quickAddTaskAction).toHaveBeenCalledWith({
			text: "Buy milk tomorrow",
			domainId: expect.any(String),
		});
		expect(createTaskAction).not.toHaveBeenCalled();
		expect(openTasks()).toEqual([parsed, OLD]);
	});

	it("saves an edit through the store, which takes the saved row", async () => {
		const edited = { ...OLD, title: "New" };
		vi.mocked(updateTaskAction).mockResolvedValue({ ok: true, data: { at: AT, rows: [edited] } });
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(<Harness mode="edit" onClose={onClose} />);
		const title = screen.getByLabelText("Task title");
		await user.clear(title);
		await user.type(title, "New");
		await user.click(screen.getByRole("button", { name: "Save" }));

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(updateTaskAction).toHaveBeenCalledWith(OLD.id, expect.any(FormData));
		expect(openTasks()).toEqual([edited]);
	});
});
