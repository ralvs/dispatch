"use client";

import { useRef, useState, useTransition } from "react";
import {
	Button,
	Dialog,
	DialogBody,
	DialogFooter,
	Field,
	Input,
	Select,
	Textarea,
} from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { DomainRow } from "@/lib/services/domains";
import { createProjectAction } from "./actions";
import { ENGAGEMENT_TYPES, KINDS, PROJECT_TYPES } from "./constants";

/**
 * Create a project — dialog behind the header's `+ New project` (Gate B / B1,
 * ADR-0043 generalised to object lists). Standing CollapsibleForm above the
 * list is gone; the form is one action on the page, not furniture in it.
 */
export function ProjectCreateButton({ domains }: { domains: DomainRow[] }) {
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	function submit(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => createProjectAction(formData),
				"Couldn't create project. Try again.",
			);
			if (ok) {
				formRef.current?.reset();
				setOpen(false);
			}
		});
	}

	return (
		<>
			<Button type="button" variant="secondary" onClick={() => setOpen(true)}>
				+ New project
			</Button>
			<Dialog open={open} onClose={() => setOpen(false)} title="New project" size="lg">
				<form ref={formRef} action={submit}>
					<DialogBody className="space-y-4">
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
								<Input
									name="quoted_hours"
									type="number"
									min="0"
									step="0.5"
									placeholder="Optional"
								/>
							</Field>
							<Field label="Start date">
								<Input name="start_date" type="date" />
							</Field>
							<Field label="Target date">
								<Input name="target_date" type="date" />
							</Field>
						</div>
					</DialogBody>
					<DialogFooter>
						<span className="min-w-2 flex-1" />
						<Button
							type="button"
							variant="tertiary"
							size="sm"
							disabled={pending}
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="primary"
							size="sm"
							isPending={pending}
							disabled={pending}
						>
							Add project
						</Button>
					</DialogFooter>
				</form>
			</Dialog>
		</>
	);
}
