"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { projectCounters } from "@/lib/counts";
import type { DomainRow } from "@/lib/schemas/domain";
import { EMPTY_TASK_COUNTS } from "@/lib/services/projects-shared";
import { useClock, useStoreActions, useWrites } from "@/lib/store";
import { projectWrites } from "./writes";

/**
 * Create a project — dialog behind the header's `+` (Gate B / B1, ADR-0043
 * generalised to object lists). Standing CollapsibleForm above the list is
 * gone; the form is one action on the page, not furniture in it.
 */
export function ProjectCreateButton({ domains }: { domains: DomainRow[] }) {
	const { submit } = useWrites();
	const { seed } = useStoreActions();
	const clock = useClock();

	async function create(formData: FormData) {
		const result = await submit(projectWrites.create(formData, domains));
		// A new project has no tasks yet: both its counts start at zero,
		// read as of the write, so every later task and finish moves them.
		if (result.ok) {
			const [row] = result.data.rows;
			if (row) {
				seed({
					...clock,
					readAt: result.data.at,
					aggregates: projectCounters({ [row.id]: EMPTY_TASK_COUNTS }),
				});
			}
		}
		return result;
	}

	return (
		<CreateDialogButton
			label="New project"
			title="New project"
			submitLabel="Add project"
			errorMessage="Couldn't create project. Try again."
			action={create}
			size="lg"
		>
			<Field name="name">
				<Input
					name="name"
					required
					placeholder="Project name"
					aria-label="Project name"
					size="lg"
					data-autofocus
				/>
			</Field>
			<Field label="Description" name="description">
				<Textarea name="description" rows={2} placeholder="Optional" size="sm" />
			</Field>
			<div className="grid grid-cols-2 gap-3">
				<Field label="Domain" name="domain_id">
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
				<Field label="Start date" name="start_date">
					<Input name="start_date" type="date" />
				</Field>
				<Field label="Target date" name="target_date">
					<Input name="target_date" type="date" />
				</Field>
			</div>
		</CreateDialogButton>
	);
}
