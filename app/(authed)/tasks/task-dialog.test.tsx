import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTaskAction } from "./actions";
import { TaskDialog } from "./task-dialog";

// A "use server" module is plain async functions in a test; replace it.
vi.mock("./actions", () => ({
	createTaskAction: vi.fn(),
	updateTaskAction: vi.fn(),
}));

const DOMAINS = [{ id: "7f1c0a4e-1111-4000-8000-000000000001", name: "Home", color: null }];

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
	const [open, setOpen] = useState(true);
	return (
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
		expect(screen.getByLabelText("Domain")).toHaveAttribute("aria-invalid", "true");
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

	it("closes on success", async () => {
		vi.mocked(createTaskAction).mockResolvedValue({ ok: true, data: undefined });
		const onClose = vi.fn();
		const user = userEvent.setup();
		render(<Harness onClose={onClose} />);
		await user.type(screen.getByLabelText("Task title"), "Buy milk");
		await user.click(screen.getByRole("button", { name: "Add task" }));

		await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});
});
