"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { nowUtc } from "@/lib/dates";
import type { DomainRow } from "@/lib/schemas/domain";
import type { ProjectRow } from "@/lib/schemas/project";
import { useClock, useStoreActions, useStoreWrite } from "@/lib/store";
import { createProjectAction } from "./actions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The project the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticProject(formData: FormData, domains: DomainRow[]): ProjectRow {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const date = (key: string) => {
		const value = text(key);
		return value && DATE.test(value) ? value : null;
	};
	const domain = domains.find((d) => d.id === text("domain_id"));
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		description: text("description"),
		domain_id: domain?.id ?? "",
		status: "active",
		start_date: date("start_date"),
		target_date: date("target_date"),
		completed_at: null,
		color: null,
		created_at: at,
		updated_at: at,
		...(domain ? { domain: { id: domain.id, name: domain.name, color: domain.color } } : {}),
	};
}

/**
 * Create a project — dialog behind the header's `+` (Gate B / B1, ADR-0043
 * generalised to object lists). Standing CollapsibleForm above the list is
 * gone; the form is one action on the page, not furniture in it.
 */
export function ProjectCreateButton({ domains }: { domains: DomainRow[] }) {
	const write = useStoreWrite("project");
	const { seed } = useStoreActions();
	const clock = useClock();

	async function create(formData: FormData) {
		const result = await write({ type: "create", row: optimisticProject(formData, domains) }, () =>
			createProjectAction(formData),
		);
		// A new project has done nothing yet: its row's count starts at zero,
		// read as of the write, so every later finish moves it.
		if (result.ok) {
			const [row] = result.data.rows;
			if (row) {
				seed({ ...clock, readAt: result.data.at, aggregates: { [`project.done:${row.id}`]: 0 } });
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
