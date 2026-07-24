"use client";

import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
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
	quickAddTaskAction,
	reopenTaskAction,
	toggleTop3Action,
} from "./actions";
import { QuickAdd } from "./quick-add";
import type { TaskDomainOption } from "./task-fields";
import { TaskForm } from "./task-form";
import { TaskRowItem } from "./task-row";

/** Raw text, Inbox defaults — the parsed row swaps in on revalidation. */
function optimisticTaskFromText(text: string): TaskRow {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		title: text,
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 4,
		project_id: null,
		domain_id: INBOX_DOMAIN_ID,
		recurrence_rule: null,
		top3_for_date: null,
		source: "manual",
		created_at: now,
		completed_at: null,
		domain: { id: INBOX_DOMAIN_ID, name: "Inbox" },
		project: null,
	};
}

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
	editTaskId,
	taskNoteIds,
}: {
	openTasks: TaskRow[];
	doneTasks: TaskRow[];
	todayIso: string;
	domains: TaskDomainOption[];
	/** From `?edit=` — opens that row's form and cleans the URL. */
	editTaskId?: string | null;
	/** task id -> linked note id, for the linked-note glyph on rows. */
	taskNoteIds?: Record<string, string>;
}) {
	const router = useRouter();
	const [, startTransition] = useTransition();
	const seed: TaskLists = { open: openTasks, done: doneTasks };
	const ctx: ApplyContext = { todayIso };

	const [lists, dispatchOptimistic] = useOptimistic(seed, (current, intent: TaskIntent) =>
		applyTaskLists(current, intent, ctx),
	);

	// Drop the deep-link query so a refresh doesn't re-force the form open.
	useEffect(() => {
		if (!editTaskId) return;
		router.replace("/tasks", { scroll: false });
	}, [editTaskId, router]);

	function run(intent: TaskIntent, action: () => Promise<void>) {
		startTransition(async () => {
			dispatchOptimistic(intent);
			// On failure optimistic state rolls back when the transition ends.
			await runAction(action, "Couldn't update that task. Try again.");
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
				createTaskAction(formData)
					.then(resolve)
					.catch((err) => {
						// Collapsible form also toasts; keep reject so form stays open.
						reject(err);
					});
			});
		});
	}

	function onQuickAdd(text: string): Promise<void> {
		const optimistic = optimisticTaskFromText(text);
		// Mirrors onCreate — same shared transition, same rollback-on-reject.
		return new Promise((resolve, reject) => {
			startTransition(() => {
				dispatchOptimistic({ type: "create", task: optimistic });
				quickAddTaskAction({ text })
					.then(resolve)
					.catch((err) => {
						reject(err);
					});
			});
		});
	}

	return (
		<>
			<section className="mt-6">
				<QuickAdd onSubmit={onQuickAdd} />
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
								initialEditing={editTaskId === t.id}
								handlers={handlersFor(t)}
								noteId={taskNoteIds?.[t.id]}
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
								initialEditing={editTaskId === t.id}
								handlers={handlersFor(t)}
							/>
						))}
					</ul>
				</section>
			)}
		</>
	);
}
