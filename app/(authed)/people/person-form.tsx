"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select } from "@/components/ui";
import { nowUtc } from "@/lib/dates";
import { type PersonRow, RelationshipTypeSchema } from "@/lib/schemas/person";
import { useStoreWrite } from "@/lib/store";
import { createPersonAction } from "./actions";
import { RELATIONSHIP_TYPES } from "./constants";

/** The person the list shows while the server writes them; the server's row replaces it (#30). */
function optimisticPerson(formData: FormData): PersonRow {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const relationship = RelationshipTypeSchema.safeParse(formData.get("relationship_type"));
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		relationship_type: relationship.success ? relationship.data : null,
		email: text("email"),
		phone: text("phone"),
		company: text("company"),
		notes: null,
		created_at: at,
		updated_at: at,
	};
}

/**
 * Create a person — dialog behind the header's `+` (Gate B / B1).
 * Same rule as projects/quotes/routines: a list of objects opens as a list.
 */
export function PersonCreateButton() {
	const write = useStoreWrite("person");

	return (
		<CreateDialogButton
			label="New person"
			title="New person"
			submitLabel="Add person"
			errorMessage="Couldn't add person. Try again."
			action={(formData) =>
				write({ type: "create", row: optimisticPerson(formData) }, () =>
					createPersonAction(formData),
				)
			}
		>
			<Field name="name">
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
				<Field label="Relationship" name="relationship_type">
					<Select name="relationship_type" defaultValue="">
						{RELATIONSHIP_TYPES.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Company" name="company">
					<Input name="company" placeholder="Optional" />
				</Field>
				<Field label="Email" name="email">
					<Input name="email" type="email" placeholder="Optional" />
				</Field>
				<Field label="Phone" name="phone">
					<Input name="phone" placeholder="Optional" />
				</Field>
			</div>
		</CreateDialogButton>
	);
}
