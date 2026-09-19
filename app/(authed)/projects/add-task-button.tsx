"use client";

import { useState } from "react";
import { TaskDialog } from "@/app/(authed)/tasks/task-dialog";
import type { TaskDomainOption, TaskProjectOption } from "@/app/(authed)/tasks/task-fields";
import { Button, HeaderCreateButton } from "@/components/ui";

/**
 * "Add task" from a project surface — the same dialog, with Project and Domain
 * pre-filled and locked (shape plan §06). ADR-0040 says there is one task
 * form, and this keeps that true: nothing new is designed and nothing is
 * duplicated.
 *
 * Two triggers, one meaning:
 * - `header` is the page `+` (project detail, ADR-0044).
 * - `row` is a labelled control on the list, because that page's `+` already
 *   means "new project" and a second identical glyph would lie.
 *
 * No `onQuickAdd`: the natural-language path is for a bare title, and this
 * create already carries answers the parser must not overrule.
 */
export function AddTaskButton({
	project,
	domainId,
	projects,
	domains,
	todayIso,
	variant = "header",
}: {
	project: TaskProjectOption;
	/** The project's domain — locked on the form, same as the project. */
	domainId: string;
	/** Full list — the locked select still renders every name so the answer reads. */
	projects: TaskProjectOption[];
	domains: TaskDomainOption[];
	todayIso: string;
	variant?: "header" | "row";
}) {
	const [open, setOpen] = useState(false);
	const label = `Add a task to ${project.name}`;

	return (
		<>
			{variant === "header" ? (
				<HeaderCreateButton label={label} onClick={() => setOpen(true)} />
			) : (
				<Button
					type="button"
					variant="secondary"
					size="sm"
					aria-label={label}
					onClick={() => setOpen(true)}
				>
					Add task
				</Button>
			)}
			<TaskDialog
				open={open}
				onClose={() => setOpen(false)}
				mode="create"
				domains={domains}
				projects={projects}
				lockProject
				lockDomain
				todayIso={todayIso}
				defaults={{ project_id: project.id, domain_id: domainId }}
			/>
		</>
	);
}
