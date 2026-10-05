import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TaskPageError from "./error";

const router = { back: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/actions/tasks", () => ({ deleteTaskAction: vi.fn() }));

// Next hands this file `retry` (16.3); a wrong prop name would leave the
// failure frame with no way to try again, and nothing else would notice.
describe("TaskPageError", () => {
	it("says the task did not open, and Try again calls Next's retry", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const user = userEvent.setup();
		const retry = vi.fn();
		render(<TaskPageError error={new Error("read failed")} retry={retry} />);

		expect(screen.getByRole("alert")).toHaveTextContent("Couldn't open this task.");
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(retry).toHaveBeenCalledOnce();

		await user.click(screen.getByRole("button", { name: "Close" }));
		expect(router.replace).toHaveBeenCalledOnce();
	});
});
