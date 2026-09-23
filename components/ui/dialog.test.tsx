import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogBody } from "./dialog";

function Harness() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				New project
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New project">
				<DialogBody>
					<input aria-label="Name" />
				</DialogBody>
			</Dialog>
		</>
	);
}

describe("Dialog", () => {
	it("moves focus in on open and back to the trigger on close", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const trigger = screen.getByRole("button", { name: "New project" });

		await user.click(trigger);
		expect(screen.getByRole("dialog", { name: "New project" })).toBeInTheDocument();
		// The close button is the first focusable element in the panel.
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Close new project" })).toHaveFocus(),
		);

		await user.click(screen.getByRole("button", { name: "Close new project" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it("closes on Escape", async () => {
		const user = userEvent.setup();
		render(<Harness />);

		await user.click(screen.getByRole("button", { name: "New project" }));
		// Escape is handled on the panel, so focus has to be inside it first.
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Close new project" })).toHaveFocus(),
		);
		await user.keyboard("{Escape}");

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "New project" })).toHaveFocus();
	});
});
