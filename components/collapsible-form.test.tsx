import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, Input, Textarea } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { CollapsibleForm } from "./collapsible-form";

const action = vi.fn(async (formData: FormData): Promise<ActionResult> => {
	const text = String(formData.get("transcription_text") ?? "");
	if (text.trim()) return { ok: true, data: undefined };
	return {
		ok: false,
		fieldErrors: { transcription_text: ["Write the entry."] },
		values: { transcription_text: text, tags: String(formData.get("tags") ?? "") },
	};
});

function renderForm() {
	render(
		<CollapsibleForm
			action={action}
			triggerLabel="+ New entry"
			submitLabel="Save entry"
			pendingLabel="Saving…"
		>
			<Field label="Entry" name="transcription_text">
				<Textarea name="transcription_text" />
			</Field>
			<Field label="Tags" name="tags">
				<Input name="tags" />
			</Field>
		</CollapsibleForm>,
	);
}

describe("CollapsibleForm", () => {
	it("keeps the card open with the message under the field and the typing in place", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.click(screen.getByRole("button", { name: "+ New entry" }));
		await user.type(screen.getByLabelText("Tags"), "work");
		await user.click(screen.getByRole("button", { name: "Save entry" }));

		expect(await screen.findByText("Write the entry.")).toBeInTheDocument();
		const entry = screen.getByLabelText("Entry");
		expect(entry).toHaveAttribute("aria-invalid", "true");
		expect(entry).toHaveAccessibleDescription("Write the entry.");
		await waitFor(() => expect(entry).toHaveFocus());
		expect(screen.getByLabelText("Tags")).toHaveValue("work");
	});

	it("collapses on success", async () => {
		const user = userEvent.setup();
		renderForm();
		await user.click(screen.getByRole("button", { name: "+ New entry" }));
		await user.type(screen.getByLabelText("Entry"), "Long day");
		await user.click(screen.getByRole("button", { name: "Save entry" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "+ New entry" })).toBeInTheDocument(),
		);
		expect(screen.queryByLabelText("Entry")).not.toBeInTheDocument();
	});
});
