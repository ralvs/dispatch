"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select } from "@/components/ui";
import { createPersonAction } from "./actions";
import { RELATIONSHIP_TYPES } from "./constants";

/**
 * Create a person — dialog behind the header's `+ New person` (Gate B / B1).
 * Same rule as projects/quotes/routines: a list of objects opens as a list.
 */
export function PersonCreateButton() {
	return (
		<CreateDialogButton
			label="+ New person"
			title="New person"
			submitLabel="Add person"
			errorMessage="Couldn't add person. Try again."
			action={createPersonAction}
		>
			<Field>
				<Input
					name="name"
					required
					placeholder="Name"
					aria-label="Person name"
					size="lg"
					data-autofocus
				/>
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
		</CreateDialogButton>
	);
}
