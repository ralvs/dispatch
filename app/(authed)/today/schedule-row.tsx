"use client";

import { Calendar, FilePlus, FileText } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { runAction } from "@/lib/client/toast";
import type { DayScheduleItem } from "@/lib/services/today";
import { type TaskRowHandlers, TaskRowItem } from "../tasks/task-row";
import { createMeetingNoteForEventAction } from "./actions";

/**
 * Quiet link/create affordance for an event's meeting note. Shares its shell
 * and glyphs with the task rows beside it (NOTE_CHIP_CLASS) so the two
 * read as one column down a schedule band rather than two conventions.
 */
function MeetingNoteGlyph({ eventId, noteId }: { eventId: string; noteId?: string }) {
	const [pending, startTransition] = useTransition();

	if (noteId) {
		return (
			<Link
				href={`/notes/${noteId}`}
				aria-label="View meeting note"
				// Icon-only, so a native tooltip carries on hover what the label
				// carries to a screen reader.
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
			onClick={() => {
				startTransition(async () => {
					await runAction(
						() => createMeetingNoteForEventAction(eventId),
						"Couldn't create a note for this event. Try again.",
					);
				});
			}}
			className={`${NOTE_CHIP_CLASS} disabled:opacity-50`}
		>
			<Icon icon={FilePlus} size="sm" />
		</button>
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
			className={`hairline flex items-center gap-3 py-3 ${past ? "opacity-50" : ""}`}
			aria-label={past ? `${event.title} (past)` : undefined}
		>
			{time && (
				<span
					className={`w-12 shrink-0 font-mono text-meta tabular-nums leading-none ${
						past ? "text-ink-4" : "text-ink-3"
					}`}
				>
					{time}
				</span>
			)}
			<Icon
				icon={Calendar}
				size="sm"
				className={`shrink-0 ${past ? "text-ink-4" : "text-ink-3"}`}
			/>
			<div className="min-w-0 flex-1">
				<p className={`truncate text-sm ${past ? "text-ink-4" : "text-ink"}`}>{event.title}</p>
				{meta && <p className="mt-0.5 truncate text-meta text-ink-4">{meta}</p>}
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
