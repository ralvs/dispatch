"use client";

import { FileText, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ColorDot } from "@/components/color-dot";
import { MentionChip } from "@/components/mention-chip";
import { Checkbox, rowTitle } from "@/components/ui";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { formatDay, formatDueLabel, formatInstant, formatLateLabel } from "@/lib/dates";
import type { MentionCandidate } from "@/lib/mentions";
import { RECURRENCE_GLYPH, recurrenceLabel } from "@/lib/recurrence";
import type { TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import { TaskDialog } from "./task-dialog";
import type { TaskDomainOption } from "./task-fields";
import { TaskNotePopover } from "./task-note-popover";

export type { TaskDomainOption };

/** Parent-owned intents (optimistic list applies, then server action). */
export type TaskRowHandlers = {
	onToggleDone: () => void;
	onToggleTop3: () => void;
	onDelete?: () => void;
};

/**
 * The Tasks page's row, and deliberately not Today's.
 *
 * The two forked on presentation and converge on behaviour — `bindTaskHandlers`,
 * the intent runner, the same server actions — because they answer different
 * questions: Today asks "what is my day" and dropped the meta line, and the
 * meta line is what this row is built around. `TaskDayRow` imports exactly one
 * thing from this file, the handlers type, and that seam is the point.
 *
 * What must not fork is the *encoding*, since a visual language cannot mean two
 * things in one app. Three things converged in Pass 1:
 *
 *  - **Priority is the ring on the checkbox**, not the P1–P4 text badge this row
 *    used to lead its meta line with. The signal belongs on the thing you reach
 *    for, and `components/ui/checkbox.tsx` already drew it for Today. The badge
 *    had no other call site and is gone.
 *  - **Overdue is `6d late`**, in the accent, from `formatLateLabel`. This row
 *    used to render `Overdue overdue 1d` — the word prepended here, the phrase
 *    from `formatDueLabel` — which was a bug and a divergence at once.
 *  - **The title is 400**, with P1 the one step to 500. It was 500 throughout,
 *    which spent the only weight step in the system on every row equally and so
 *    said nothing (DESIGN.md, "The Two Weights Rule").
 *
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
	 * completion date and time. Today can show done rows in place (docs/adr/0038)
	 * but does not pass tz — those rows restyle via status, not a timestamp.
	 */
	tz?: string;
	/** @mention candidates (docs/adr/0030) for the edit form's title/notes autocomplete. */
	people?: MentionCandidate[];
	/** People already mentioned in this task — rendered as chips in the meta line. */
	mentions?: { id: string; name: string }[];
}) {
	const [editing, setEditing] = useState(initialEditing);
	const rowRef = useRef<HTMLLIElement>(null);
	const done = task.status === "done";
	const overdue = isOverdue(task, todayIso);
	// `isOverdue` owns the question (and knows a done task is never late);
	// `formatLateLabel` only formats the gap. Null on a same-day due date, which
	// is why the due branch below still has to fall through to formatDueLabel.
	const late = overdue && task.due_date ? formatLateLabel(task.due_date, todayIso) : null;
	const starTarget = starDateIso ?? todayIso;
	const starred = isTop3Today(task, starTarget);
	// The star acts on whichever day the surface is showing, so the label has to
	// say which one — "today's top 3" is a lie on Today's other days.
	const starDay = starTarget === todayIso ? "today" : formatDay(starTarget, "utc", "cccc d LLLL");
	const scheduled = timeLabel !== undefined;
	const canEdit = manageable && domains.length > 0;
	// The task's own notes field — a whitespace-only value is not a note.
	const noteText = task.notes?.trim() || null;

	// The row stays in place behind the dialog, so bring it into view rather
	// than leaving the deep-linked task somewhere off-screen underneath.
	useEffect(() => {
		if (!initialEditing || !editing) return;
		rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
	}, [initialEditing, editing]);

	function remove() {
		if (!handlers.onDelete) return;
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		setEditing(false);
		handlers.onDelete();
	}

	// Body size at 400 is what DESIGN.md gives every row title; P1 takes the one
	// step up, which is the same step Today's row takes and the only reason the
	// step still carries information.
	const titleClass = rowTitle({
		tone: done ? "done" : "default",
		emphasis: task.priority === 1 && !done ? "strong" : "normal",
		// The `after:` pseudo-element is this row's 44px touch target, which needs
		// the link to be its own positioned box rather than a truncating block.
		layout: "bare",
		className: `relative block max-w-full text-left after:absolute after:-inset-y-3 after:inset-x-0 after:content-[''] active:opacity-70 ${
			canEdit || !manageable ? "hover:text-accent-ink" : ""
		}`,
	});

	return (
		<li
			ref={rowRef}
			className="hairline flex min-h-12 items-center gap-3 py-3"
			data-task-id={task.id}
		>
			{canEdit && (
				<TaskDialog
					open={editing}
					onClose={() => setEditing(false)}
					mode="edit"
					taskId={task.id}
					domains={domains}
					todayIso={todayIso}
					people={people}
					onDelete={handlers.onDelete ? remove : undefined}
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
			)}
			{scheduled && timeLabel && (
				<span className="w-12 shrink-0 font-mono text-meta tabular-nums leading-none text-ink-3">
					{timeLabel}
				</span>
			)}
			<Checkbox
				checked={done}
				priority={task.priority}
				aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
				onChange={handlers.onToggleDone}
				className="shrink-0"
			/>
			{/* `hold` because this list runs to twenty rows: a dot that comes and
			    goes gives every unfiled title a different left edge (DESIGN.md,
			    "The Invisible Slot Rule"). Today's lists are short enough not to
			    need it. The name still rides the meta line beneath, which is what
			    pairs the colour with a word — nine domains are not decodable by
			    hue alone. */}
			<ColorDot color={task.domain?.color} hold />
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
				{/* The row's description of itself, in words. The domain's dot is
				    not repeated here — it leads the row in the left column, and
				    this is the name that pairs the colour with a word. */}
				<p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-meta text-ink-4">
					<span>
						{task.domain?.name ?? "—"}
						{task.project?.name ? ` · ${task.project.name}` : ""}
						{/* A finished task has no due phrase. `formatDueLabel` is
						    purely relative to today, so a task completed last week
						    read `overdue 9d` in the "Recently done" band — an
						    assertion that it is late, about a task that is done.
						    The completion stamp two fields along already answers
						    "when", and it answers it truthfully. */}
						{!scheduled && !done && task.due_date && (
							<span className={overdue ? "text-accent-slip" : ""}>
								{" · "}
								{/* Late is never colour-only — the word carries the signal
								    alongside the orange, and it is the same word Today
								    uses. `late` is null on a date that has not passed, and
								    on the same-day edge, so the due phrase is the fallback
								    rather than the exception. */}
								{late ?? formatDueLabel(task.due_date, todayIso)}
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
							<span>{` · ${formatInstant(task.completed_at, tz)}`}</span>
						)}
					</span>
					{mentions?.map((person) => (
						<MentionChip key={person.id} id={person.id} name={person.name} />
					))}
				</p>
			</div>
			{/* Note chips ride in the right-hand control column with the star,
			    centered against the whole row, rather than trailing the meta
			    line — they act on the task, so they belong beside the other
			    control rather than inside the row's description of itself.
			    gap-2 is load-bearing: each chip's after: reaches 4px past its
			    own box, so anything tighter would overlap the neighbour's hit
			    area and swallow taps meant for it. */}
			{/* The star is the only chip every row has, so it anchors the column at
			    the far right and the optional chips stack inward from it —
			    linked-note, then task-notes, then star. Absent chips render nothing
			    rather than holding an empty slot.
			    gap-3: star hit-area reaches 8px past its box, chips 4px past theirs. */}
			<div className="flex shrink-0 items-center gap-3">
				{noteId && (
					<Link
						href={`/notes/${noteId}`}
						aria-label="View linked note"
						title="View linked note"
						onClick={(e) => e.stopPropagation()}
						className={NOTE_CHIP_CLASS}
					>
						<Icon icon={FileText} size="sm" />
					</Link>
				)}
				{noteText && <TaskNotePopover notes={noteText} title={task.title} />}
				<button
					type="button"
					aria-label={`${starred ? "Remove from" : "Pin to"} ${starDay}'s top 3`}
					aria-pressed={starred}
					disabled={done}
					onClick={handlers.onToggleTop3}
					className={`hit-area relative inline-flex size-4 items-center justify-center leading-none [--hit-x:8px] [--hit-y:14px] active:opacity-70 ${
						starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
					} ${done ? "invisible" : ""}`}
				>
					<Icon icon={Star} size="md" fill={starred ? "currentColor" : "none"} />
				</button>
			</div>
		</li>
	);
}
