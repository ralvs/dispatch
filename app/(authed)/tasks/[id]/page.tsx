import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskEditor, TaskEditorLoading, TaskEditorProblem } from "@/components/task-editor";
import { Seed } from "@/lib/store/seed";
import { readTaskToOpen } from "@/lib/task-interaction/open-task";
import { TasksBody, TasksFallback } from "../tasks-body";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
	const open = await readTaskToOpen((await params).id);
	return open ? { title: open.task.title } : {};
}

/** The dialog half of the page: the task form, once the row is read. */
async function OpenTask({ params }: { params: Params }) {
	const open = await readTaskToOpen((await params).id);
	if (!open) return <TaskEditorProblem exit="tasks" />;
	return (
		<Seed snapshot={open.snapshot}>
			<TaskEditor
				taskId={open.task.id}
				domains={open.domains}
				projects={open.projects}
				people={open.people}
				todayIso={open.todayIso}
				exit="tasks"
			/>
		</Seed>
	);
}

/**
 * A task loaded by its own URL (docs/adr/0079): a refresh, a notification, a
 * link from outside. A link followed inside the app never lands here — the
 * `@modal/(.)tasks/[id]` route intercepts it and opens the dialog over the
 * page it was on. Here there is no such page, so the dialog opens over the
 * Tasks board, and closing it leaves you on `/tasks`.
 *
 * Two boundaries, so the dialog does not wait for the board, nor the board for
 * the dialog.
 */
export default function TaskPage({ params }: { params: Params }) {
	return (
		<>
			<Suspense fallback={<TasksFallback />}>
				<TasksBody filters={{}} />
			</Suspense>
			<Suspense fallback={<TaskEditorLoading exit="tasks" />}>
				<OpenTask params={params} />
			</Suspense>
		</>
	);
}
