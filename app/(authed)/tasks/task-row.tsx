"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { formatDueLabel } from "@/lib/dates";
import { RECURRENCE_GLYPH } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import { updateTaskAction } from "./actions";
import { PriorityBadge, type TaskDomainOption, TaskFormFields } from "./task-fields";

export type { TaskDomainOption };

/** Parent-owned intents (optimistic list applies, then server action). */
export type TaskRowHandlers = {
	onToggleDone: () => void;
	onToggleTop3: () => void;
	onDelete?: () => void;
};

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
	manageable = true,
	initialEditing = false,
	handlers,
	noteId,
}: {
	task: TaskRow;
	todayIso: string;
	timeLabel?: string | null;
	domains?: TaskDomainOption[];
	/** Edit/delete only make sense on the Tasks page — Today is read-mostly. */
	manageable?: boolean;
	/** Open the edit form on mount (deep-link from Today via `?edit=`). */
	initialEditing?: boolean;
	handlers: TaskRowHandlers;
	/** Linked note id, if any — renders a quiet glyph in the meta line. */
	noteId?: string;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(initialEditing);
	const formWrapRef = useRef<HTMLLIElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const done = task.status === "done";
	const overdue = isOverdue(task, todayIso);
	const starred = isTop3Today(task, todayIso);
	const scheduled = timeLabel !== undefined;
	const canEdit = manageable && domains.length > 0;

	useEffect(() => {
		if (!initialEditing || !editing) return;
		formWrapRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
		// Focus title so typing / Esc / Enter are immediately available.
		const title = formRef.current?.querySelector<HTMLInputElement>('input[name="title"]');
		title?.focus();
		title?.select();
	}, [initialEditing, editing]);

	function save(formData: FormData) {
		// Edit waits for the server (no optimistic multi-field patch).
		startTransition(async () => {
			const ok = await runAction(
				() => updateTaskAction(task.id, formData),
				"Couldn't save task. Try again.",
			);
			if (ok) setEditing(false);
		});
	}

	function remove() {
		if (!handlers.onDelete) return;
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		handlers.onDelete();
	}

	function onFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
		if (e.key === "Escape") {
			e.preventDefault();
			setEditing(false);
			return;
		}
		// Enter saves from single-line fields; leave textarea for newlines.
		if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
			// Native submit already fires for text inputs; skip buttons/selects
			// that use Enter for their own activation.
			if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) {
				return;
			}
			e.preventDefault();
			formRef.current?.requestSubmit();
		}
	}

	if (editing && canEdit) {
		return (
			<li
				ref={formWrapRef}
				className={`hairline py-3 ${pending ? "opacity-50" : ""}`}
				data-task-id={task.id}
			>
				{/* Symmetric indent so the edit surface is narrower than list rows. */}
				<form
					ref={formRef}
					action={save}
					onKeyDown={onFormKeyDown}
					className="mx-6 space-y-2.5 border-x border-line-strong px-3 py-1 sm:mx-10 sm:px-4"
				>
					<TaskFormFields
						domains={domains}
						showNotes
						defaults={{
							title: task.title,
							notes: task.notes,
							due_date: task.due_date,
							due_time: task.due_time,
							domain_id: task.domain_id,
							priority: task.priority,
							recurrence_rule: task.recurrence_rule,
						}}
					/>
					<div className="flex flex-wrap items-center gap-2 pt-0.5">
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
						{handlers.onDelete && (
							<button
								type="button"
								disabled={pending}
								onClick={remove}
								aria-label={`Delete task "${task.title}"`}
								className="ml-auto rounded-md border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
							>
								Delete
							</button>
						)}
					</div>
				</form>
			</li>
		);
	}

	const titleClass = `text-left text-sm ${
		done ? "text-ink-4 line-through" : "text-ink"
	} ${canEdit || !manageable ? "hover:text-accent-ink" : ""}`;

	return (
		<li className="hairline flex items-center gap-3 py-2.5" data-task-id={task.id}>
			{scheduled && timeLabel && (
				<span className="w-12 shrink-0 self-center font-mono text-meta tabular-nums leading-none text-ink-3">
					{timeLabel}
				</span>
			)}
			<input
				type="checkbox"
				checked={done}
				aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
				onChange={handlers.onToggleDone}
				className={`h-4 w-4 shrink-0 appearance-none self-center border ${
					done ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
				}`}
			/>
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-baseline gap-1.5">
					{canEdit ? (
						<button
							type="button"
							onClick={() => setEditing(true)}
							className={`${titleClass} min-w-0 truncate`}
							aria-label={`Edit task "${task.title}"`}
						>
							{task.title}
						</button>
					) : (
						// Today (and other read-mostly surfaces): jump to Tasks with this row open.
						<Link
							href={`/tasks?edit=${task.id}`}
							className={`${titleClass} min-w-0 truncate`}
							aria-label={`Open task "${task.title}" for editing`}
						>
							{task.title}
						</Link>
					)}
					{task.recurrence_rule && (
						<span className="shrink-0 text-ink-4" title={task.recurrence_rule}>
							{RECURRENCE_GLYPH}
						</span>
					)}
				</p>
				<p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-meta text-ink-4">
					<PriorityBadge priority={task.priority} className={done ? "opacity-50" : undefined} />
					<span>
						{task.domain?.name ?? "—"}
						{task.project?.name ? ` · ${task.project.name}` : ""}
						{!scheduled && task.due_date && (
							<span className={overdue ? "text-accent-slip" : ""}>
								{" · "}
								{formatDueLabel(task.due_date, todayIso)}
								{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
							</span>
						)}
					</span>
					{noteId && (
						<Link
							href={`/notes/${noteId}`}
							aria-label="View linked note"
							onClick={(e) => e.stopPropagation()}
							className="text-ink-4 hover:text-ink"
						>
							¶
						</Link>
					)}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-1 self-center">
				<button
					type="button"
					aria-label={starred ? "Remove from today's top 3" : "Pin to today's top 3"}
					aria-pressed={starred}
					disabled={done}
					onClick={handlers.onToggleTop3}
					className={`text-base leading-none ${
						starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
					} ${done ? "invisible" : ""}`}
				>
					{starred ? "★" : "☆"}
				</button>
			</div>
		</li>
	);
}
