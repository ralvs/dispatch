"use client";

import { useState } from "react";
import { TaskDialog } from "@/app/(authed)/tasks/task-dialog";
import type { TaskDomainOption, TaskProjectOption } from "@/app/(authed)/tasks/task-fields";
import { Button } from "@/components/ui";

/**
 * "Add task" from a project surface — the same dialog, with the Project field
 * pre-filled and locked (shape plan §06). ADR-0040 says there is one task
 * form, and this keeps that true: nothing new is designed and nothing is
 * duplicated.
 *
 * No `onQuickAdd`: the natural-language path is for a bare title, and this
 * create already carries an answer the parser must not overrule.
 */
export function AddTaskButton({
	project,
	projects,
	domains,
	todayIso,
	label = "Add task",
}: {
	project: TaskProjectOption;
	/** Full list — the locked select still renders every name so the answer reads. */
	projects: TaskProjectOption[];
	domains: TaskDomainOption[];
	todayIso: string;
	label?: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				variant="tertiary"
				size="sm"
				aria-label={`Add a task to ${project.name}`}
				onClick={() => setOpen(true)}
			>
				{label}
			</Button>
			<TaskDialog
				open={open}
				onClose={() => setOpen(false)}
				mode="create"
				domains={domains}
				projects={projects}
				lockProject
				todayIso={todayIso}
				defaults={{ project_id: project.id }}
			/>
		</>
	);
}
