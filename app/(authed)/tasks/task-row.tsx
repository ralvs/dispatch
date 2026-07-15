"use client";

import { useTransition } from "react";
import { RECURRENCE_GLYPH } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import { completeTaskAction, reopenTaskAction, toggleTop3Action } from "./actions";

export function TaskRowItem({ task, todayIso }: { task: TaskRow; todayIso: string }) {
	const [pending, startTransition] = useTransition();
	const done = task.status === "done";
	const overdue = isOverdue(task, todayIso);
	const starred = isTop3Today(task, todayIso);

	return (
		<li
			className={`hairline flex items-baseline gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}
			data-task-id={task.id}
		>
			<input
				type="checkbox"
				checked={done}
				aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
				disabled={pending}
				onChange={() =>
					startTransition(() => (done ? reopenTaskAction(task.id) : completeTaskAction(task.id)))
				}
				className={`h-4 w-4 shrink-0 appearance-none self-center border ${
					done ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
				}`}
			/>
			<div className="min-w-0 flex-1">
				<p className={`text-sm ${done ? "text-ink-4 line-through" : "text-ink"}`}>
					{task.title}
					{task.recurrence_rule && (
						<span className="ml-1.5 text-ink-4" title={task.recurrence_rule}>
							{RECURRENCE_GLYPH}
						</span>
					)}
				</p>
				<p className="mt-0.5 font-mono text-meta text-ink-4">
					{task.domain?.name ?? "—"}
					{task.project?.name ? ` · ${task.project.name}` : ""}
					{task.due_date && (
						<span className={overdue ? "text-accent-slip" : ""}>
							{" · "}
							{task.due_date}
							{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
						</span>
					)}
				</p>
			</div>
			<button
				type="button"
				aria-label={starred ? "Remove from today's top 3" : "Pin to today's top 3"}
				aria-pressed={starred}
				disabled={pending || done}
				onClick={() => startTransition(() => toggleTop3Action(task.id))}
				className={`self-center text-base leading-none ${
					starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
				} ${done ? "invisible" : ""}`}
			>
				{starred ? "★" : "☆"}
			</button>
		</li>
	);
}
