"use client";

import Link from "next/link";
import { useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { DayScheduleItem } from "@/lib/services/today";
import { type TaskRowHandlers, TaskRowItem } from "../tasks/task-row";
import { createMeetingNoteForEventAction } from "./actions";

function IconCalendar({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<rect x="2.5" y="3.5" width="11" height="10" rx="0.5" />
			<path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
		</svg>
	);
}

/** Quiet link/create affordance for an event's meeting note — mirrors the
 * mono metadata styling used elsewhere in Today. */
function MeetingNoteGlyph({ eventId, noteId }: { eventId: string; noteId?: string }) {
	const [pending, startTransition] = useTransition();

	// The chip stays visually tiny; the padded wrapper grows its hit area to 44px.
	if (noteId) {
		return (
			<span className="-m-2.5 inline-flex shrink-0 items-center self-center p-2.5">
				<Link
					href={`/notes/${noteId}`}
					aria-label="View meeting note"
					className="inline-flex items-center gap-1 rounded border border-line px-1 py-px text-[10px] leading-none text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
				>
					<span aria-hidden="true">¶</span> Note
				</Link>
			</span>
		);
	}

	return (
		<span className="-m-2.5 inline-flex shrink-0 items-center self-center p-2.5">
			<button
				type="button"
				aria-label="Create meeting note"
				disabled={pending}
				onClick={() => {
					startTransition(async () => {
						await runAction(
							() => createMeetingNoteForEventAction(eventId),
							"Couldn't create a note for this event. Try again.",
						);
					});
				}}
				className="inline-flex items-center gap-1 rounded border border-line px-1 py-px text-[10px] leading-none text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-50 active:opacity-70"
			>
				<span aria-hidden="true">+</span> Note
			</button>
		</span>
	);
}

// The calendar icon is what says "this is an event, not a task" — it sits in
// the checkbox's column so events and tasks line up in the same band.
function EventRow({
	item,
	past,
	noteId,
}: {
	item: Extract<DayScheduleItem, { kind: "event" }>;
	past: boolean;
	noteId?: string;
}) {
	const { event, time } = item;
	const meta = [event.calendar_name, event.location].filter(Boolean).join(" · ");

	return (
		<li
			className={`hairline flex items-center gap-3 py-2.5 ${past ? "opacity-50" : ""}`}
			aria-label={past ? `${event.title} (past)` : undefined}
		>
			{time && (
				<span
					className={`w-12 shrink-0 self-center font-mono text-meta tabular-nums leading-none ${
						past ? "text-ink-4" : "text-ink-3"
					}`}
				>
					{time}
				</span>
			)}
			<IconCalendar
				className={`h-4 w-4 shrink-0 self-center ${past ? "text-ink-4" : "text-ink-3"}`}
			/>
			<div className="min-w-0 flex-1">
				<p className={`truncate text-sm ${past ? "text-ink-4" : "text-ink"}`}>{event.title}</p>
				{meta && <p className="mt-0.5 truncate font-mono text-meta text-ink-4">{meta}</p>}
			</div>
			<MeetingNoteGlyph eventId={event.id} noteId={noteId} />
		</li>
	);
}

/**
 * One row of a schedule band. Events carry their own chrome; tasks reuse the
 * Tasks-page row so complete and top-3 behave identically wherever they appear.
 */
export function ScheduleRow({
	item,
	dateIso,
	todayIso,
	handlers,
	nowUtcIso,
	noteId,
}: {
	item: DayScheduleItem;
	/** The day on screen — what ☆ reflects and pins to. */
	dateIso: string;
	todayIso: string;
	handlers?: TaskRowHandlers;
	/** Used to gray out timed events that have already ended. */
	nowUtcIso?: string;
	/** The linked note's id, if any — meeting note for events, linked note for tasks. */
	noteId?: string;
}) {
	if (item.kind === "task") {
		if (!handlers) return null;
		return (
			<TaskRowItem
				task={item.task}
				todayIso={todayIso}
				starDateIso={dateIso}
				timeLabel={item.time}
				manageable={false}
				handlers={handlers}
				noteId={noteId}
			/>
		);
	}
	// Compare instants, not strings: Postgres hands back "+00:00" where
	// toISOString() writes "Z", so the two only sort alike by accident.
	const past = Boolean(nowUtcIso && Date.parse(item.event.end_at) < Date.parse(nowUtcIso));
	return <EventRow item={item} past={past} noteId={noteId} />;
}
