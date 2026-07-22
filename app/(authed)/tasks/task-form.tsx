"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { type TaskDomainOption, TaskFormFields } from "./task-fields";

export function TaskForm({
	domains,
	action,
}: {
	domains: TaskDomainOption[];
	action: (formData: FormData) => Promise<unknown>;
}) {
	const form = useCollapsibleForm(action);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New task"
			submitLabel="Add task"
			pendingLabel="Adding…"
		>
			<TaskFormFields domains={domains} titlePlaceholder="What needs doing?" />
		</CollapsibleForm>
	);
}
