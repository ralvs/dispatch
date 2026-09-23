import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { CreateDialogButton } from "./create-dialog";

// A stand-in for a form-fed server action: rejects a blank name the way
// runFormAction does, echoing what was typed.
const action = vi.fn(async (formData: FormData): Promise<ActionResult> => {
	const name = String(formData.get("name") ?? "");
	if (name.trim()) return { ok: true, data: undefined };
	return {
		ok: false,
		fieldErrors: { name: ["Give the person a name."] },
		values: { name, company: String(formData.get("company") ?? "") },
	};
});

function renderDialog() {
	render(
		<CreateDialogButton
			label="New person"
			title="New person"
			submitLabel="Add person"
			errorMessage="Couldn't save person."
			action={action}
		>
			<Field label="Name" name="name">
				<Input name="name" />
			</Field>
			<Field label="Company" name="company">
				<Input name="company" />
			</Field>
		</CreateDialogButton>,
	);
}

describe("CreateDialogButton", () => {
	it("shows a rejected field's message under it and keeps what was typed", async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.click(screen.getByRole("button", { name: "New person" }));
		await user.type(screen.getByLabelText("Company"), "Acme");
		await user.click(screen.getByRole("button", { name: "Add person" }));

		const name = screen.getByLabelText("Name");
		expect(await screen.findByText("Give the person a name.")).toBeInTheDocument();
		expect(name).toHaveAttribute("aria-invalid", "true");
		expect(name).toHaveAccessibleDescription("Give the person a name.");
		expect(screen.getByLabelText("Company")).toHaveValue("Acme");
		await waitFor(() => expect(name).toHaveFocus());
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});

	it("closes on success, and opens clean the next time", async () => {
		const user = userEvent.setup();
		renderDialog();
		await user.click(screen.getByRole("button", { name: "New person" }));
		await user.click(screen.getByRole("button", { name: "Add person" }));
		expect(await screen.findByText("Give the person a name.")).toBeInTheDocument();

		await user.type(screen.getByLabelText("Name"), "Bia");
		await user.click(screen.getByRole("button", { name: "Add person" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

		await user.click(screen.getByRole("button", { name: "New person" }));
		expect(screen.getByLabelText("Name")).toHaveValue("");
		expect(screen.queryByText("Give the person a name.")).not.toBeInTheDocument();
	});
});
