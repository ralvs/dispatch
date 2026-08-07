"use client";

import { Calendar, FilePlus, FileText, Star } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { Checkbox } from "@/components/ui";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { runAction } from "@/lib/client/toast";
import { formatDueLabel } from "@/lib/dates";
import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";
import type { TaskRow } from "@/lib/services/tasks";
import type { DayScheduleItem } from "@/lib/services/today";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";
import { eventColor } from "@/lib/ui/event-color";
import type { TaskRowHandlers } from "../tasks/task-row";
import { createMeetingNoteForEventAction } from "./actions";

/*
 * Today's row. Deliberately not the Tasks page's TaskRowItem: this composition
 * dropped the meta line, and what it dropped is exactly what that row is built
 * around. What the two share is behaviour — bindTaskHandlers, applyDayIntent,
 * the same server actions — which is the seam that actually matters. The
 * presentation is allowed to differ because it is answering a different
 * question: Tasks asks "what is this task", Today asks "what is my day".
 *
 * One shape across all three bands, so the eye reads one column down the page:
 *
 *   [ time ] [ mark ] [ dot ] title ......... [ due ] [ chips ]
 *
 * The mark is a checkbox for a task and a calendar glyph for an event, in the
 * same 19px column — that glyph is what says "this is not yours to tick".
 */

/** Days late, as the comps' `6d late`. Null when the task is not overdue. */
function lateLabel(task: TaskRow, todayIso: string): string | null {
	if (!task.due_date || !isOverdue(task, todayIso)) return null;
	const days = Math.round(
		(Date.parse(`${todayIso}T00:00:00Z`) - Date.parse(`${task.due_date}T00:00:00Z`)) / 86_400_000,
	);
	return days > 0 ? `${days}d late` : null;
}

function DomainDot({ color }: { color: string }) {
	return (
		<span
			aria-hidden="true"
			className="inline-block size-[9px] shrink-0 rounded-full"
			style={{ background: color }}
		/>
	);
}

/**
 * Quiet link/create affordance for an event's meeting note. Shares its shell
 * and glyphs with the task rows beside it (NOTE_CHIP_CLASS) so the two read as
 * one column rather than two conventions.
 */
function MeetingNoteGlyph({ eventId, noteId }: { eventId: string; noteId?: string }) {
	const [pending, startTransition] = useTransition();

	if (noteId) {
		return (
			<Link
				href={`/notes/${noteId}`}
				aria-label="View meeting note"
				title="View meeting note"
				className={NOTE_CHIP_CLASS}
			>
				<Icon icon={FileText} size="sm" />
			</Link>
		);
	}
	return (
		<button
			type="button"
			aria-label="Create meeting note"
			title="Create meeting note"
			disabled={pending}
			onClick={() =>
				startTransition(async () => {
					await runAction(
						() => createMeetingNoteForEventAction(eventId),
						"Couldn't create a note for this event. Try again.",
					);
				})
			}
			className={`${NOTE_CHIP_CLASS} disabled:opacity-50`}
		>
			<Icon icon={FilePlus} size="sm" />
		</button>
	);
}

/**
 * The star is not in the comps, and its absence there is a gap rather than a
 * decision: Top 3's own empty slot says "Star a task to pin it", so the page
 * promises an affordance it would otherwise not carry. Leaving the page to
 * pin a task is the failure case for this surface (the surface brief's first
 * paragraph), so it stays — quiet, at the end of the row, out of the way of
 * the title.
 */
function StarButton({
	task,
	starDay,
	starred,
	onToggle,
}: {
	task: TaskRow;
	starDay: string;
	starred: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			aria-label={`${starred ? "Remove from" : "Pin to"} ${starDay}'s top 3`}
			aria-pressed={starred}
			disabled={task.status === "done"}
			onClick={onToggle}
			className={`hit-area relative inline-flex size-4 shrink-0 items-center justify-center [--hit-x:8px] [--hit-y:14px] active:opacity-70 ${
				starred ? "text-accent" : "text-ink-4 hover:text-ink-2"
			} ${task.status === "done" ? "invisible" : ""}`}
		>
			<Icon icon={Star} size="md" fill={starred ? "currentColor" : "none"} />
		</button>
	);
}

export function TaskDayRow({
	task,
	time,
	todayIso,
	starDateIso,
	handlers,
	noteId,
	rank,
}: {
	task: TaskRow;
	/** Wall-clock time when the row sits on the Timeline; null elsewhere. */
	time?: string | null;
	todayIso: string;
	/** Which day ☆ pins to — the day on screen, not necessarily today. */
	starDateIso: string;
	handlers: TaskRowHandlers;
	noteId?: string;
	/** Top 3 only: the slot number, printed as 01/02/03. */
	rank?: number;
}) {
	const done = task.status === "done";
	const late = lateLabel(task, todayIso);
	const slug = task.domain?.color;
	const starred = isTop3Today(task, starDateIso);
	const due = task.due_date && !time ? formatDueLabel(task.due_date, todayIso) : null;

	return (
		<li className="flex min-h-12 items-center gap-3 border-b border-line py-3 last:border-b-0">
			{rank !== undefined && (
				<span aria-hidden="true" className="shrink-0 font-mono text-meta tabular-nums text-ink-4">
					{String(rank).padStart(2, "0")}
				</span>
			)}
			{time !== undefined && (
				<span className="w-11 shrink-0 font-mono text-meta tabular-nums text-ink-3">{time}</span>
			)}
			<Checkbox
				checked={done}
				priority={task.priority}
				aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
				onChange={handlers.onToggleDone}
				className="shrink-0"
			/>
			{isColorSlug(slug) && <DomainDot color={colorSlugVar(slug)} />}
			{/* Read-mostly surface: the title opens the task on Tasks rather than
			    an editor here, which is what the incumbent row did too. */}
			<Link
				href={`/tasks?edit=${task.id}`}
				aria-label={`Open task "${task.title}" for editing`}
				className={`min-w-0 flex-1 truncate text-base leading-[1.35] tracking-[-0.01em] hover:text-accent-ink ${
					done ? "text-ink-4 line-through" : "text-ink"
				} ${task.priority === 1 && !done ? "font-medium" : ""}`}
			>
				{task.title}
			</Link>
			{(late || due) && (
				<span
					className={`shrink-0 font-mono text-meta tabular-nums ${late ? "text-accent" : "text-ink-4"}`}
				>
					{late ?? due}
				</span>
			)}
			{noteId && (
				<Link
					href={`/notes/${noteId}`}
					aria-label="View linked note"
					title="View linked note"
					className={NOTE_CHIP_CLASS}
				>
					<Icon icon={FileText} size="sm" />
				</Link>
			)}
			<StarButton
				task={task}
				starDay={starDateIso === todayIso ? "today" : "that day"}
				starred={starred}
				onToggle={handlers.onToggleTop3}
			/>
		</li>
	);
}

export function EventDayRow({
	item,
	past,
	noteId,
}: {
	item: Extract<DayScheduleItem, { kind: "event" }>;
	/** An event that has ended stays on the day — it just stops competing. */
	past: boolean;
	noteId?: string;
}) {
	const { event, time } = item;

	return (
		<li
			className={`flex min-h-12 items-center gap-3 border-b border-line py-3 last:border-b-0 ${past ? "opacity-50" : ""}`}
			aria-label={past ? `${event.title} (past)` : undefined}
		>
			<span className="w-11 shrink-0 font-mono text-meta tabular-nums text-ink-3">{time}</span>
			<span className="grid size-[19px] shrink-0 place-items-center text-ink-3">
				<Icon icon={Calendar} size="md" />
			</span>
			<DomainDot color={eventColor(event.calendar_name)} />
			<span className="min-w-0 flex-1 truncate text-base leading-[1.35] tracking-[-0.01em] text-ink">
				{event.title}
			</span>
			<MeetingNoteGlyph eventId={event.id} noteId={noteId} />
		</li>
	);
}
