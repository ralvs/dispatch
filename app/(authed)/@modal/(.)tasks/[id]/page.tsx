import { TaskEditor, TaskEditorProblem } from "@/components/task-editor";
import { readTaskToOpen } from "@/lib/task-interaction/open-task";

/**
 * A task link followed inside the app (docs/adr/0079): the task form opens
 * over the page the link was on, and the address is the task's own,
 * `/tasks/<id>`. Back, Cancel, Save and Delete all return to that page.
 *
 * A missing task is said in the dialog, not with notFound(): inside a slot
 * that would put the whole not-found page over the one underneath.
 */
export default async function TaskModal({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const open = await readTaskToOpen(id);
	if (!open) return <TaskEditorProblem exit="back" />;
	return (
		<TaskEditor
			task={open.task}
			domains={open.domains}
			projects={open.projects}
			people={open.people}
			todayIso={open.todayIso}
			exit="back"
		/>
	);
}
