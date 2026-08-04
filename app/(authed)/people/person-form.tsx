"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { Field, Input, Select } from "@/components/ui";
import { createPersonAction } from "./actions";
import { RELATIONSHIP_TYPES } from "./constants";

export function PersonForm() {
	const form = useCollapsibleForm(createPersonAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New person"
			submitLabel="Add person"
			pendingLabel="Adding…"
		>
			<Field>
				<Input name="name" required placeholder="Name" aria-label="Person name" size="lg" />
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Relationship">
					<Select name="relationship_type" defaultValue="">
						{RELATIONSHIP_TYPES.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Company">
					<Input name="company" placeholder="Optional" />
				</Field>
				<Field label="Email">
					<Input name="email" type="email" placeholder="Optional" />
				</Field>
				<Field label="Phone">
					<Input name="phone" placeholder="Optional" />
				</Field>
			</div>
		</CollapsibleForm>
	);
}
