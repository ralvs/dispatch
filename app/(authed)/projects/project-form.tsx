"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui";
import type { DomainRow } from "@/lib/services/domains";
import { createProjectAction } from "./actions";
import { ENGAGEMENT_TYPES, KINDS, PROJECT_TYPES } from "./constants";

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
					<Select name="domain_id" defaultValue="">
						<option value="">Unassigned</option>
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Type">
					<Select name="type" defaultValue="">
						{PROJECT_TYPES.map((t) => (
							<option key={t.value} value={t.value}>
								{t.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Kind">
					<Select name="kind" defaultValue="project">
						{KINDS.map((k) => (
							<option key={k.value} value={k.value}>
								{k.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Engagement">
					<Select name="engagement_type" defaultValue="project">
						{ENGAGEMENT_TYPES.map((e) => (
							<option key={e.value} value={e.value}>
								{e.label}
							</option>
						))}
					</Select>
				</Field>
				<Field label="Quoted hours">
					<Input name="quoted_hours" type="number" min="0" step="0.5" placeholder="Optional" />
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
