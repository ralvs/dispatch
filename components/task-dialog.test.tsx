import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskAction } from "@/lib/actions/tasks";
import { createDispatchStore } from "@/lib/store/create-store";
import { StoreProvider } from "@/lib/store/provider";
import { Seed } from "@/lib/store/seed";
import { snapshot, T1 } from "@/lib/store/test-fixtures";
import { TaskDialog } from "./task-dialog";

// A "use server" module is plain async functions in a test; replace it.
vi.mock("@/lib/actions/tasks", () => ({
	createTaskAction: vi.fn(),
	quickAddTaskAction: vi.fn(),
	updateTaskAction: vi.fn(),
}));

const DOMAINS = [{ id: "7f1c0a4e-1111-4000-8000-000000000001", name: "Home", color: null }];
const SEED = snapshot(T1);

let store: ReturnType<typeof createDispatchStore>;
beforeEach(() => {
	store = createDispatchStore();
});

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
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
					mode="create"
					domains={DOMAINS}
					todayIso="2026-09-22"
				/>
			</Seed>
		</StoreProvider>
	);
}

describe("TaskDialog", () => {
	beforeEach(() => vi.mocked(createTaskAction).mockReset());

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
		answer({ ok: true, data: { at: "2026-09-30T12:00:00.000Z", rows: [] } });

		// …and confirmed once it does.
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(store.getState().pending).toEqual([]);
		expect(store.getState().confirmed).toHaveLength(1);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
