"use client";

import { useOptimistic, useTransition } from "react";
import { INBOX_DOMAIN_ID } from "@/lib/constants";
import type { TaskRow } from "@/lib/services/tasks";
import {
	type ApplyContext,
	applyTaskLists,
	type TaskIntent,
	type TaskLists,
} from "@/lib/task-interaction/apply-intent";
import {
	completeTaskAction,
	createTaskAction,
	deleteTaskAction,
	reopenTaskAction,
	toggleTop3Action,
} from "./actions";
import { TaskForm } from "./task-form";
import { type TaskDomainOption, TaskRowItem } from "./task-row";

function optimisticTaskFromForm(formData: FormData, domains: TaskDomainOption[]): TaskRow {
	const title = String(formData.get("title") ?? "").trim() || "Untitled";
	const domainId = String(formData.get("domain_id") ?? "") || INBOX_DOMAIN_ID;
	const domain = domains.find((d) => d.id === domainId);
	const dueDate = String(formData.get("due_date") ?? "") || null;
	const dueTime = String(formData.get("due_time") ?? "") || null;
	const priorityRaw = Number(formData.get("priority"));
	const priority = Number.isFinite(priorityRaw) ? priorityRaw : 4;
	const recurrence = String(formData.get("recurrence_rule") ?? "") || null;
	const notes = String(formData.get("notes") ?? "") || null;
	const now = new Date().toISOString();

	return {
		id: crypto.randomUUID(),
		title,
		notes,
		status: "open",
		due_date: dueDate,
		due_time: dueTime,
		priority,
		project_id: null,
		domain_id: domainId,
		recurrence_rule: recurrence,
		top3_for_date: null,
		source: "manual",
		created_at: now,
		completed_at: null,
		domain: domain ? { id: domain.id, name: domain.name } : { id: domainId, name: "Inbox" },
		project: null,
	};
}

export function TaskList({
	openTasks,
	doneTasks,
	todayIso,
	domains,
}: {
	openTasks: TaskRow[];
	doneTasks: TaskRow[];
	todayIso: string;
	domains: TaskDomainOption[];
}) {
	const [, startTransition] = useTransition();
	const seed: TaskLists = { open: openTasks, done: doneTasks };
	const ctx: ApplyContext = { todayIso };

	const [lists, dispatchOptimistic] = useOptimistic(seed, (current, intent: TaskIntent) =>
		applyTaskLists(current, intent, ctx),
	);

	function run(intent: TaskIntent, action: () => Promise<void>) {
		startTransition(async () => {
			dispatchOptimistic(intent);
			try {
				await action();
			} catch {
				// useOptimistic rolls back when the transition ends without a
				// matching RSC refresh; rethrow so the console still sees it.
				throw new Error("Task update failed");
			}
		});
	}

	function handlersFor(task: TaskRow) {
		const done = task.status === "done";
		return {
			onToggleDone: () => {
				if (done) {
					run({ type: "reopen", id: task.id }, () => reopenTaskAction(task.id));
				} else {
					run({ type: "complete", id: task.id }, () => completeTaskAction(task.id));
				}
			},
			onToggleTop3: () => {
				run({ type: "toggleTop3", id: task.id }, () => toggleTop3Action(task.id));
			},
			onDelete: () => {
				run({ type: "delete", id: task.id }, () => deleteTaskAction(task.id));
			},
		};
	}

	function onCreate(formData: FormData): Promise<void> {
		const optimistic = optimisticTaskFromForm(formData, domains);
		// useOptimistic must run inside a transition owned here (not only the form's).
		return new Promise((resolve, reject) => {
			startTransition(() => {
				dispatchOptimistic({ type: "create", task: optimistic });
				createTaskAction(formData).then(resolve).catch(reject);
			});
		});
	}

	return (
		<>
			<section className="mt-6">
				<TaskForm domains={domains} action={onCreate} />
			</section>

			<section className="mt-6" aria-label="Open tasks">
				{lists.open.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						Nothing on the docket. Capture something.
					</p>
				) : (
					<ul>
						{lists.open.map((t) => (
							<TaskRowItem
								key={t.id}
								task={t}
								todayIso={todayIso}
								domains={domains}
								handlers={handlersFor(t)}
							/>
						))}
					</ul>
				)}
			</section>

			{lists.done.length > 0 && (
				<section className="mt-10" aria-label="Recently completed">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Recently done
					</h2>
					<ul className="mt-2">
						{lists.done.map((t) => (
							<TaskRowItem
								key={t.id}
								task={t}
								todayIso={todayIso}
								domains={domains}
								handlers={handlersFor(t)}
							/>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
