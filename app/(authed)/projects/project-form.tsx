"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui";
import type { DomainRow } from "@/lib/services/domains";
import { createProjectAction } from "./actions";

/**
 * Create a project — dialog behind the header's `+` (Gate B / B1, ADR-0043
 * generalised to object lists). Standing CollapsibleForm above the list is
 * gone; the form is one action on the page, not furniture in it.
 */
export function ProjectCreateButton({ domains }: { domains: DomainRow[] }) {
	return (
		<CreateDialogButton
			label="New project"
			title="New project"
			submitLabel="Add project"
			errorMessage="Couldn't create project. Try again."
			action={createProjectAction}
			size="lg"
		>
			<Field>
				<Input
					name="name"
					required
					placeholder="Project name"
					aria-label="Project name"
					size="lg"
					data-autofocus
				/>
			</Field>
			<Field label="Description">
				<Textarea name="description" rows={2} placeholder="Optional" size="sm" />
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Domain">
					<Select name="domain_id" defaultValue="" required>
						<option value="" disabled>
							Choose a domain
						</option>
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Start date">
					<Input name="start_date" type="date" />
				</Field>
				<Field label="Target date">
					<Input name="target_date" type="date" />
				</Field>
			</div>
		</CreateDialogButton>
	);
}
