"use client";

import Link from "next/link";
import { type KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";
import { ColorDot } from "@/components/color-dot";
import { MentionChip } from "@/components/mention-chip";
import { runAction } from "@/lib/client/toast";
import { formatDay, formatDueLabel, formatInstant } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";
import { RECURRENCE_GLYPH, recurrenceLabel } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import { updateTaskAction } from "./actions";
import { PriorityBadge, type TaskDomainOption, TaskFormFields } from "./task-fields";
import { TaskNotePopover } from "./task-note-popover";

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
	starDateIso,
	timeLabel,
	domains = [],
	manageable = true,
	initialEditing = false,
	handlers,
	noteId,
	tz,
	people = [],
	mentions,
}: {
	task: TaskRow;
	todayIso: string;
	/**
	 * Which day ☆ reflects and pins to. Defaults to today; Today's day
	 * navigation passes the day on screen so the star reads as that day's
	 * shortlist. Overdue and the due label stay anchored to the real today.
	 */
	starDateIso?: string;
	timeLabel?: string | null;
	domains?: TaskDomainOption[];
	/** Edit/delete only make sense on the Tasks page — Today is read-mostly. */
	manageable?: boolean;
	/** Open the edit form on mount (deep-link from Today via `?edit=`). */
	initialEditing?: boolean;
	handlers: TaskRowHandlers;
	/** Linked note id, if any — renders a quiet glyph in the meta line. */
	noteId?: string;
	/**
	 * Optional on purpose: only "Recently done" (Tasks page) needs it to show a
	 * completion time. Today's call sites never pass it because completed tasks
	 * are filtered out of every band before they'd reach this component.
	 */
	tz?: string;
	/** @mention candidates (docs/adr/0030) for the edit form's title/notes autocomplete. */
	people?: MentionCandidate[];
	/** People already mentioned in this task — rendered as chips in the meta line. */
	mentions?: { id: string; name: string }[];
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(initialEditing);
	const formWrapRef = useRef<HTMLLIElement>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const done = task.status === "done";
	const overdue = isOverdue(task, todayIso);
	const starTarget = starDateIso ?? todayIso;
	const starred = isTop3Today(task, starTarget);
	// The star acts on whichever day the surface is showing, so the label has to
	// say which one — "today's top 3" is a lie on Today's other days.
	const starDay = starTarget === todayIso ? "today" : formatDay(starTarget, "utc", "cccc d LLLL");
	const scheduled = timeLabel !== undefined;
	const canEdit = manageable && domains.length > 0;
	// The task's own notes field — a whitespace-only value is not a note.
	const noteText = task.notes?.trim() || null;

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
						todayIso={todayIso}
						showNotes
						people={people}
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
							className="rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg active:opacity-70 disabled:opacity-50"
						>
							{pending ? "Saving…" : "Save"}
						</button>
						<button
							type="button"
							disabled={pending}
							onClick={() => setEditing(false)}
							className="rounded-md border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
						>
							Cancel
						</button>
						{handlers.onDelete && (
							<button
								type="button"
								disabled={pending}
								onClick={remove}
								aria-label={`Delete task "${task.title}"`}
								className="ml-auto rounded-md border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-error hover:border-error active:opacity-70"
							>
								Delete
							</button>
						)}
					</div>
				</form>
			</li>
		);
	}

	const titleClass = `relative block max-w-full text-left font-serif text-base after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] active:opacity-70 ${
		done ? "text-ink-4 line-through" : "text-ink"
	} ${canEdit || !manageable ? "hover:text-accent-ink" : ""}`;

	return (
		<li className="hairline flex items-center gap-3 py-2.5" data-task-id={task.id}>
			{scheduled && timeLabel && (
				<span className="w-12 shrink-0 self-center font-mono text-meta tabular-nums leading-none text-ink-3">
					{timeLabel}
				</span>
			)}
			{/* Native checkbox can't take generated content, so the tappable area
			    comes from a label wrapper (padding pulled back in with a matching
			    negative margin so it doesn't disturb the row's flex gap). */}
			<label className="relative -m-3.5 flex shrink-0 cursor-pointer self-center p-3.5 active:opacity-70">
				<input
					type="checkbox"
					checked={done}
					aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
					onChange={handlers.onToggleDone}
					className={`h-4 w-4 appearance-none border ${
						done ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
					}`}
				/>
			</label>
			<div className="min-w-0 flex-1">
				<p className="flex min-w-0 items-baseline gap-1.5">
					{/* The hit-target expansion lives on the control itself (button/link),
					    not this wrapper — a pseudo-element only extends the hit area of
					    its own element, so putting it here would just swallow the click.
					    Truncation moves to the inner span so the control isn't an
					    overflow-hidden clipping container that would clip the after:. */}
					<span className="min-w-0">
						{canEdit ? (
							<button
								type="button"
								onClick={() => setEditing(true)}
								className={titleClass}
								aria-label={`Edit task "${task.title}"`}
							>
								<span className="block truncate">{task.title}</span>
							</button>
						) : (
							// Today (and other read-mostly surfaces): jump to Tasks with this row open.
							<Link
								href={`/tasks?edit=${task.id}`}
								className={titleClass}
								aria-label={`Open task "${task.title}" for editing`}
							>
								<span className="block truncate">{task.title}</span>
							</Link>
						)}
					</span>
				</p>
				<p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-meta text-ink-4">
					<PriorityBadge priority={task.priority} className={done ? "opacity-50" : undefined} />
					<span>
						<span className="inline-flex items-center gap-1">
							<ColorDot color={task.domain?.color} />
							{task.domain?.name ?? "—"}
						</span>
						{task.project?.name ? ` · ${task.project.name}` : ""}
						{!scheduled && task.due_date && (
							<span className={overdue ? "text-accent-slip" : ""}>
								{" · "}
								{/* Overdue is never color-only — a text label carries the
								    signal the same way PriorityBadge pairs color with P1–P4. */}
								{overdue && "Overdue "}
								{formatDueLabel(task.due_date, todayIso)}
								{task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}
							</span>
						)}
						{recurrenceLabel(task.recurrence_rule) && (
							<span>
								{" · "}
								{RECURRENCE_GLYPH} {recurrenceLabel(task.recurrence_rule)}
							</span>
						)}
						{done && task.completed_at && tz && (
							<span>{` · ${formatInstant(task.completed_at, tz, "HH:mm")}`}</span>
						)}
					</span>
					{noteText && <TaskNotePopover notes={noteText} title={task.title} />}
					{noteId && (
						<Link
							href={`/notes/${noteId}`}
							aria-label="View linked note"
							onClick={(e) => e.stopPropagation()}
							// Vertical reach kept smaller than the ideal 44px: this chip sits
							// in a flex-wrap meta row with no row-gap, so a full expansion
							// would overlap whatever wraps onto the line below it.
							className="relative inline-flex shrink-0 items-center gap-1 rounded border border-line px-1 py-px text-[10px] leading-none text-ink-3 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-[''] hover:border-line-strong hover:text-ink active:opacity-70"
						>
							<span aria-hidden="true">¶</span> Note
						</Link>
					)}
					{mentions?.map((person) => (
						<MentionChip key={person.id} id={person.id} name={person.name} />
					))}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-1 self-center">
				<button
					type="button"
					aria-label={`${starred ? "Remove from" : "Pin to"} ${starDay}'s top 3`}
					aria-pressed={starred}
					disabled={done}
					onClick={handlers.onToggleTop3}
					className={`relative text-base leading-none after:absolute after:-inset-3.5 after:content-[''] active:opacity-70 ${
						starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
					} ${done ? "invisible" : ""}`}
				>
					{starred ? "★" : "☆"}
				</button>
			</div>
		</li>
	);
}
