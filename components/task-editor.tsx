"use client";

import { usePathname, useRouter } from "next/navigation";
import { TaskDialog } from "@/components/task-dialog";
import type { TaskDomainOption, TaskProjectOption } from "@/components/task-fields";
import {
	Bone,
	Button,
	Dialog,
	DialogBody,
	DialogFooter,
	SkeletonStatus,
	TextBone,
} from "@/components/ui";
import { deleteTaskAction } from "@/lib/actions/tasks";
import type { MentionCandidate } from "@/lib/mentions";
import { useView, viewKey } from "@/lib/store";
import { useTaskIntentRunner } from "@/lib/task-interaction/run-intent";

/**
 * A task opened by its own URL, `/tasks/<id>` (docs/adr/0079): the one task
 * form (docs/adr/0040) in edit mode, plus the frames it shows before the row
 * arrives and when it cannot.
 *
 * Two routes render it. The intercepted one (`@modal/(.)tasks/[id]`) opens over
 * whatever page the link was on, so closing goes `back` to that page. The
 * hard-load one (`tasks/[id]`) opens over the Tasks board, so closing goes to
 * `/tasks`, the list already behind it.
 *
 * The row comes from the entity store (docs/adr/0069), where both routes seed
 * it as a list of one (`viewKey.task`): an edit made in this tab wins over the
 * router's older copy of the render, so the form never reopens on old values.
 */

export type TaskEditorExit = "back" | "tasks";

function useExit(exit: TaskEditorExit) {
	const router = useRouter();
	return () => (exit === "back" ? router.back() : router.replace("/tasks", { scroll: false }));
}

export function TaskEditor({
	taskId,
	domains,
	projects,
	people,
	todayIso,
	exit,
}: {
	taskId: string;
	domains: TaskDomainOption[];
	projects: TaskProjectOption[];
	people: MentionCandidate[];
	todayIso: string;
	exit: TaskEditorExit;
}) {
	const leave = useExit(exit);
	const run = useTaskIntentRunner();
	// Open while the address is this task's own, and never a flag set on close.
	// Cache Components keeps a page you leave alive in a hidden <Activity>,
	// state and all, and shows it again when you come back: a `closed` flag
	// set on the way out was still set on the way back in, so opening the same
	// task a second time from Today showed nothing.
	const open = usePathname() === `/tasks/${taskId}`;
	// Empty only once this tab deleted it, while the way out is under way.
	const task = useView(viewKey.task(taskId))?.[0];
	if (!task) return null;

	function remove() {
		if (!task) return;
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		run({ type: "delete", id: task.id }, () => deleteTaskAction(task.id));
		leave();
	}

	return (
		<TaskDialog
			open={open}
			onClose={leave}
			mode="edit"
			taskId={task.id}
			domains={domains}
			projects={projects}
			todayIso={todayIso}
			people={people}
			onDelete={remove}
			defaults={{
				title: task.title,
				notes: task.notes,
				due_date: task.due_date,
				due_time: task.due_time,
				domain_id: task.domain_id,
				project_id: task.project_id,
				priority: task.priority,
				recurrence_rule: task.recurrence_rule,
			}}
		/>
	);
}

/** The edit form's frame while the row is in flight: same title, same size. */
export function TaskEditorLoading({ exit }: { exit: TaskEditorExit }) {
	const leave = useExit(exit);
	return (
		<Dialog open onClose={leave} title="Edit task" size="lg" sheet>
			<DialogBody className="space-y-10">
				<SkeletonStatus />
				<TextBone className="text-lg" width="w-3/4" />
				<div className="space-y-3">
					<TextBone className="font-mono text-meta" width="w-16" />
					<Bone className="h-10 w-full rounded-control" />
				</div>
				<div className="space-y-3">
					<TextBone className="font-mono text-meta" width="w-20" />
					<Bone className="h-24 w-full rounded-control" />
				</div>
			</DialogBody>
			<DialogFooter>
				<span className="min-w-2 flex-1" />
				<Bone className="h-7 w-16 rounded-control" />
				<Bone className="h-7 w-16 rounded-control" />
			</DialogFooter>
		</Dialog>
	);
}

/**
 * The frame when the task cannot be shown: gone (`missing`), or a read that
 * failed (`onRetry`). Plain words, never the raw error.
 */
export function TaskEditorProblem({
	exit,
	onRetry,
}: {
	exit: TaskEditorExit;
	/** Absent: the task does not exist, so there is nothing to retry. */
	onRetry?: () => void;
}) {
	const leave = useExit(exit);
	return (
		<Dialog open onClose={leave} title="Edit task" size="lg" sheet>
			<DialogBody>
				<p role="alert" className="text-ink-2">
					{onRetry ? "Couldn't open this task." : "This task no longer exists."}
				</p>
				{onRetry && (
					<p className="mt-1 text-meta text-ink-4">Check the connection and try again.</p>
				)}
			</DialogBody>
			<DialogFooter>
				<span className="min-w-2 flex-1" />
				<Button type="button" variant="tertiary" size="sm" onClick={leave}>
					Close
				</Button>
				{onRetry && (
					<Button type="button" variant="primary" size="sm" onClick={onRetry}>
						Try again
					</Button>
				)}
			</DialogFooter>
		</Dialog>
	);
}
