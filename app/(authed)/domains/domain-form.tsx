"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Textarea } from "@/components/ui";
import { useClock, useStoreActions, useWrites } from "@/lib/store";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { domainWrites } from "./writes";

/**
 * Create a domain — dialog behind the header's `+` (ADR-0044).
 * Standing CollapsibleForm above the list is gone with the move out of settings.
 */
export function DomainCreateButton() {
	const { submit } = useWrites();
	const { seed } = useStoreActions();
	const clock = useClock();

	async function create(formData: FormData) {
		const result = await submit(domainWrites.create(formData));
		// A new domain has no open tasks yet: its count starts at zero, read as
		// of the write, so a task filed into it moves it (lib/counts.ts).
		if (result.ok) {
			const [row] = result.data.rows;
			if (row)
				seed({ ...clock, readAt: result.data.at, aggregates: { [`domain.open:${row.id}`]: 0 } });
		}
		return result;
	}

	return (
		<CreateDialogButton
			label="New domain"
			title="New domain"
			submitLabel="Add domain"
			errorMessage="Couldn't create domain. Try again."
			action={create}
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
