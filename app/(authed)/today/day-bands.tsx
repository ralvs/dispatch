"use client";

import { Card, EmptyState, SectionHead } from "@/components/ui";
import type { DaySchedule } from "@/lib/day-schedule";
import type { TaskRow } from "@/lib/services/tasks";
import { TOP3_SLOTS } from "@/lib/task-predicates";
import type { DomainColorSource } from "@/lib/ui/event-color";
import { TODAY_VARIANT } from "@/lib/ui/variant";
import type { TaskRowHandlers } from "../tasks/task-row";
import { EventDayRow, TaskDayRow } from "./day-row";

/**
 * The day's three lists, as three separately-placeable sections.
 *
 * They are separate exports rather than one component because the desktop
 * composition puts Top 3 in the right column and Timeline/Open in the left,
 * and a phone re-sequences all three against sections that are not the day's
 * at all. One component could not sit in two columns.
 *
 * They do NOT own their own optimistic state — DayView does, and hands each a
 * projection of the same store plus the same `handlersFor`. Two stores would
 * mean ticking a task in Top 3 leaves its Timeline twin unchecked.
 */

type Placement = {
	schedule: DaySchedule;
	/** The day on screen — what ☆ reflects and pins to, and what `due` counts from. */
	dateIso: string;
	/** The real calendar today: a recurrence rolls forward from the wall clock. */
	todayIso: string;
	handlersFor: (task: TaskRow) => TaskRowHandlers;
	eventNoteIds?: Record<string, string>;
	taskNoteIds?: Record<string, string>;
	domains?: readonly DomainColorSource[];
};

/**
 * The priority legend, and it earns its place only when priority is actually
 * drawn: three ring swatches under the `ring` variant, and nothing under
 * `rail`, which would need three rail heights instead. It also hides on an
 * empty day, where there is no ring on screen to decode.
 */
function PriorityLegend() {
	if (TODAY_VARIANT !== "ring") return null;
	const swatches = [
		{
			key: "high",
			label: "high",
			className: "border-priority-high shadow-[0_0_0_3px_var(--priority-high-halo)]",
		},
		{ key: "medium", label: "med", className: "border-priority-med" },
		{ key: "low", label: "low", className: "border-line-strong" },
	];
	return (
		<div className="flex items-center gap-3.5 lg:gap-4" aria-hidden="true">
			{swatches.map((s) => (
				<span key={s.key} className="flex items-center gap-1.5 font-mono text-meta text-ink-4">
					<i className={`block size-[13px] shrink-0 rounded-[5px] border-2 ${s.className}`} />
					{s.label}
				</span>
			))}
		</div>
	);
}

/**
 * A band with nothing in it says so in words rather than collapsing. The
 * divider is what makes it stand in the position of a row: the band below still
 * needs its rule.
 */
function Placeholder({ lead, hint }: { lead: string; hint?: string }) {
	return (
		<EmptyState divider hint={hint}>
			{lead}
		</EmptyState>
	);
}

/**
 * An unfilled slot renders as a slot, not as a gap: three is the shape of the
 * commitment, and a two-row list would quietly rewrite it.
 */
export function Top3Section({ schedule, dateIso, todayIso, handlersFor, taskNoteIds }: Placement) {
	const { top3 } = schedule;
	const slotsOpen = TOP3_SLOTS - top3.length;

	return (
		<section className="t-sec-top3 t-day-owned" aria-label="Top 3">
			<Card padding="none" className="px-6 py-5 lg:py-[22px]">
				<SectionHead
					title="Top 3 today"
					aside={
						slotsOpen > 0 ? (
							<span className="font-mono text-meta text-ink-3">
								{slotsOpen} slot{slotsOpen === 1 ? "" : "s"} open
							</span>
						) : undefined
					}
				/>
				<ul>
					{top3.map((task, i) => (
						<TaskDayRow
							key={task.id}
							task={task}
							rank={i + 1}
							todayIso={todayIso}
							dateIso={dateIso}
							handlers={handlersFor(task)}
							noteId={taskNoteIds?.[task.id]}
						/>
					))}
					{Array.from({ length: slotsOpen }).map((_, i) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length empty slots, never reordered.
							key={`slot-${i}`}
							className="flex min-h-12 items-center gap-3 border-b border-line py-3 last:border-b-0"
						>
							<span
								aria-hidden="true"
								className="shrink-0 font-mono text-meta tabular-nums text-ink-4"
							>
								{String(top3.length + i + 1).padStart(2, "0")}
							</span>
							<span className="text-base italic text-ink-4">Star a task to pin it</span>
						</li>
					))}
				</ul>
			</Card>
		</section>
	);
}

export function TimelineSection({
	schedule,
	dateIso,
	todayIso,
	handlersFor,
	eventNoteIds,
	taskNoteIds,
	domains,
	nowUtcIso,
}: Placement & { nowUtcIso: string }) {
	const { timeline } = schedule;

	return (
		<section className="t-sec-timeline t-day-owned" aria-label="Timeline">
			<SectionHead title="Timeline" />
			{timeline.length === 0 ? (
				<Placeholder
					lead="Nothing on the clock."
					hint="Give a task a time, or let the calendar fill it."
				/>
			) : (
				<ul>
					{timeline.map((item) =>
						item.kind === "event" ? (
							<EventDayRow
								key={item.key}
								item={item}
								// Compare instants, not strings: Postgres hands back
								// "+00:00" where toISOString() writes "Z", so the two only
								// sort alike by accident.
								past={Date.parse(item.event.end_at) < Date.parse(nowUtcIso)}
								noteId={eventNoteIds?.[item.event.id]}
								domains={domains}
							/>
						) : (
							<TaskDayRow
								key={item.key}
								task={item.task}
								time={item.time}
								todayIso={todayIso}
								dateIso={dateIso}
								handlers={handlersFor(item.task)}
								noteId={taskNoteIds?.[item.task.id]}
							/>
						),
					)}
				</ul>
			)}
		</section>
	);
}

export function OpenSection({ schedule, dateIso, todayIso, handlersFor, taskNoteIds }: Placement) {
	const { open } = schedule;

	return (
		<section className="t-sec-open t-day-owned" aria-label="Open">
			<SectionHead title="Open" aside={open.length > 0 ? <PriorityLegend /> : undefined} />
			{open.length === 0 ? (
				<Placeholder lead="Nothing open." />
			) : (
				<ul>
					{open.map((task) => (
						<TaskDayRow
							key={task.id}
							task={task}
							todayIso={todayIso}
							dateIso={dateIso}
							handlers={handlersFor(task)}
							noteId={taskNoteIds?.[task.id]}
						/>
					))}
				</ul>
			)}
		</section>
	);
}
