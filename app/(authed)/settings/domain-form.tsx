"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { Field, Input, Textarea } from "@/components/ui";
import { createDomainAction } from "./actions";

export function DomainForm() {
	const form = useCollapsibleForm(createDomainAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New domain"
			submitLabel="Add domain"
			pendingLabel="Adding…"
		>
			<Field>
				<Input name="name" required placeholder="Domain name" aria-label="Domain name" size="lg" />
			</Field>
			<Field label="Description">
				<Textarea name="description" rows={2} placeholder="Optional" size="sm" />
			</Field>
			<Field label="Fruit definition">
				<Textarea
					name="fruit_definition"
					rows={2}
					placeholder="What does healthy look like here?"
					size="sm"
				/>
			</Field>
			<Field label="Expected cadence">
				<Input name="expected_cadence" placeholder="Optional" />
			</Field>
			<ColorSwatchPicker name="color" />
		</CollapsibleForm>
	);
}
