import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogBody } from "./dialog";

function Harness({ sheet = false }: { sheet?: boolean }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" onClick={() => setOpen(true)}>
				New project
			</button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New project" sheet={sheet}>
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

	// The phone layout is a class change; the modal contract must not move with it.
	it("as a sheet, still traps the page behind it and closes on Escape", async () => {
		const user = userEvent.setup();
		render(<Harness sheet />);
		const trigger = screen.getByRole("button", { name: "New project" });

		await user.click(trigger);
		const dialog = screen.getByRole("dialog", { name: "New project" });
		expect(dialog).toHaveAttribute("data-sheet");
		expect(trigger.closest("[inert]")).not.toBeNull();
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Close new project" })).toHaveFocus(),
		);

		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(trigger.closest("[inert]")).toBeNull();
		expect(trigger).toHaveFocus();
	});
});
