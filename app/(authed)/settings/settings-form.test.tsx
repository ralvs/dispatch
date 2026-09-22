import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, Input } from "@/components/ui";
import type { ActionResult } from "@/lib/action-result";
import { SettingsForm } from "./settings-form";

describe("SettingsForm", () => {
	it("shows a rejected field's message and keeps the value", async () => {
		const action = vi.fn(
			async (formData: FormData): Promise<ActionResult> => ({
				ok: false,
				fieldErrors: { reminder_anchor_time: ["Must be a wall-clock time (HH:MM)."] },
				values: { reminder_anchor_time: String(formData.get("reminder_anchor_time")) },
			}),
		);
		const user = userEvent.setup();
		render(
			<SettingsForm action={action} errorMessage="Couldn't save." note="A note.">
				<Field label="Anchor time" name="reminder_anchor_time">
					<Input name="reminder_anchor_time" defaultValue="09:00" />
				</Field>
			</SettingsForm>,
		);
		const input = screen.getByLabelText("Anchor time");
		await user.clear(input);
		await user.type(input, "9am");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(await screen.findByText("Must be a wall-clock time (HH:MM).")).toBeInTheDocument();
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveValue("9am");
	});

	it("is silent on success and keeps the saved value", async () => {
		const action = vi.fn(async (): Promise<ActionResult> => ({ ok: true, data: undefined }));
		const user = userEvent.setup();
		render(
			<SettingsForm action={action} errorMessage="Couldn't save." note="A note.">
				<Field label="Anchor time" name="reminder_anchor_time">
					<Input name="reminder_anchor_time" defaultValue="09:00" />
				</Field>
			</SettingsForm>,
		);
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(action).toHaveBeenCalledOnce();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Anchor time")).toHaveValue("09:00");
	});
});
