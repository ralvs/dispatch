import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskEditorProblem } from "./task-editor";

const router = { back: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/tasks", () => ({ deleteTaskAction: vi.fn() }));

beforeEach(() => {
	router.back.mockReset();
	router.replace.mockReset();
});

// The two ways a task fails to open (#97, docs/adr/0079): it never says
// "loading" for ever, and it never offers a retry that cannot help.
describe("TaskEditorProblem", () => {
	it("a failed read says so and retries", async () => {
		const user = userEvent.setup();
		const retry = vi.fn();
		render(<TaskEditorProblem exit="back" onRetry={retry} />);

		const dialog = screen.getByRole("dialog", { name: "Edit task" });
		expect(dialog).toHaveTextContent("Couldn't open this task.");
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("a missing task says it is gone, and closing leaves for /tasks", async () => {
		const user = userEvent.setup();
		render(<TaskEditorProblem exit="tasks" />);

		expect(screen.getByRole("alert")).toHaveTextContent("This task no longer exists.");
		expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(router.replace).toHaveBeenCalledWith("/tasks", { scroll: false });
	});

	it("inside the app, closing goes back to the page underneath", async () => {
		const user = userEvent.setup();
		render(<TaskEditorProblem exit="back" />);
		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(router.back).toHaveBeenCalledOnce();
	});
});
