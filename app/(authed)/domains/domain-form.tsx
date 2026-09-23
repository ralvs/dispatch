"use client";

import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Textarea } from "@/components/ui";
import { createDomainAction } from "./actions";

/**
 * Create a domain — dialog behind the header's `+` (ADR-0044).
 * Standing CollapsibleForm above the list is gone with the move out of settings.
 */
export function DomainCreateButton() {
	return (
		<CreateDialogButton
			label="New domain"
			title="New domain"
			submitLabel="Add domain"
			errorMessage="Couldn't create domain. Try again."
			action={createDomainAction}
			size="lg"
		>
			<Field name="name">
				<Input
					name="name"
					required
					placeholder="Domain name"
					aria-label="Domain name"
					size="lg"
					data-autofocus
				/>
			</Field>
			<Field label="Description" name="description">
				<Textarea name="description" rows={2} placeholder="Optional" size="sm" />
			</Field>
			<Field label="Fruit definition" name="fruit_definition">
				<Textarea
					name="fruit_definition"
					rows={2}
					placeholder="What does healthy look like here?"
					size="sm"
				/>
			</Field>
			<Field label="Expected cadence" name="expected_cadence">
				<Input name="expected_cadence" placeholder="Optional" />
			</Field>
			<ColorSwatchPicker name="color" />
		</CreateDialogButton>
	);
}
