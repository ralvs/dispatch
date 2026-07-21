"use client";

import { useState, useTransition } from "react";
import { formatDueLabel } from "@/lib/dates";
import { RECURRENCE_GLYPH, RECURRENCE_LABELS, RECURRENCE_PATTERNS } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import {
	completeTaskAction,
	deleteTaskAction,
	reopenTaskAction,
	toggleTop3Action,
	updateTaskAction,
} from "./actions";

export type TaskDomainOption = { id: string; name: string; is_system: boolean };

/**
 * Passing `timeLabel` places the row inside one of Today's schedule bands: it
 * gains a clock column (null renders the all-day dash) and drops the due-date
 * meta, since its position on the day already says when it is due.
 */
export function TaskRowItem({
	task,
	todayIso,
	timeLabel,
	domains = [],
}: {
	task: TaskRow;
	todayIso: string;
	timeLabel?: string | null;
	domains?: TaskDomainOption[];
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const done = task.status === "done";
	const overdue = isOverdue(task, todayIso);
	const starred = isTop3Today(task, todayIso);
	const scheduled = timeLabel !== undefined;
	const canEdit = domains.length > 0;

	function save(formData: FormData) {
		startTransition(async () => {
			await updateTaskAction(task.id, formData);
			setEditing(false);
		});
	}

	function remove() {
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		startTransition(() => deleteTaskAction(task.id));
	}

	if (editing && canEdit) {
		const dueTime = task.due_time ? task.due_time.slice(0, 5) : "";
		return (
			<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`} data-task-id={task.id}>
				<form action={save} className="space-y-3">
					<input
						name="title"
						required
						defaultValue={task.title}
						aria-label="Task title"
						className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none"
					/>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Notes</span>
						<textarea
							name="notes"
							rows={2}
							defaultValue={task.notes ?? ""}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Due date</span>
							<input
								type="date"
								name="due_date"
								defaultValue={task.due_date ?? ""}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Time</span>
							<input
								type="time"
								name="due_time"
								defaultValue={dueTime}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							/>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Domain</span>
							<select
								name="domain_id"
								defaultValue={task.domain_id}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							>
								{domains.map((d) => (
									<option key={d.id} value={d.id}>
										{d.name}
									</option>
								))}
							</select>
						</label>
						<label className="block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Priority</span>
							<select
								name="priority"
								defaultValue={String(task.priority)}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							>
								<option value="1">P1 — critical</option>
								<option value="2">P2</option>
								<option value="3">P3</option>
								<option value="4">P4 — someday</option>
							</select>
						</label>
						<label className="col-span-2 block">
							<span className="font-mono text-eyebrow uppercase text-ink-3">Repeats</span>
							<select
								name="recurrence_rule"
								defaultValue={task.recurrence_rule ?? ""}
								className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
							>
								<option value="">Never</option>
								{RECURRENCE_PATTERNS.map((p) => (
									<option key={p} value={p}>
										{RECURRENCE_LABELS[p]}
									</option>
								))}
							</select>
						</label>
					</div>
					<div className="flex gap-2">
						<button
							type="submit"
							disabled={pending}
							className="rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
						>
							{pending ? "Saving…" : "Save"}
						</button>
						<button
							type="button"
							disabled={pending}
							onClick={() => setEditing(false)}
							className="rounded-md border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
						>
							Cancel
						</button>
					</div>
				</form>
			</li>
		);
	}

	return (
		<li
			className={`hairline flex items-baseline gap-3 py-2.5 ${pending ? "opacity-50" : ""}`}
			data-task-id={task.id}
		>
			{scheduled && (
				<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
					{timeLabel}
				</span>
			)}
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
					{!scheduled && task.due_date && (
						<span className={overdue ? "text-accent-slip" : ""}>
							{" · "}
							{formatDueLabel(task.due_date, todayIso)}
							{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
						</span>
					)}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-1 self-center">
				<button
					type="button"
					aria-label={starred ? "Remove from today's top 3" : "Pin to today's top 3"}
					aria-pressed={starred}
					disabled={pending || done}
					onClick={() => startTransition(() => toggleTop3Action(task.id))}
					className={`text-base leading-none ${
						starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
					} ${done ? "invisible" : ""}`}
				>
					{starred ? "★" : "☆"}
				</button>
				{canEdit ? (
					<button
						type="button"
						aria-label={`Edit task "${task.title}"`}
						disabled={pending}
						onClick={() => setEditing(true)}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Edit
					</button>
				) : null}
				<button
					type="button"
					aria-label={`Delete task "${task.title}"`}
					disabled={pending}
					onClick={remove}
					className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
				>
					Delete
				</button>
			</div>
		</li>
	);
}
