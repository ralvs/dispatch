"use client";

import { useOptimistic } from "react";
import type { TaskRow } from "@/lib/services/tasks";
import type { DaySchedule } from "@/lib/services/today";
import {
	type ApplyContext,
	applyDayIntent,
	type TaskIntent,
} from "@/lib/task-interaction/apply-intent";
import { bindTaskHandlers, useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { TOP3_SLOTS } from "@/lib/task-predicates";
import { completeTaskAction, reopenTaskAction, setTop3Action } from "../tasks/actions";
import { TaskRowItem } from "../tasks/task-row";
import { ScheduleRow } from "./schedule-row";

function Band({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-8">
			<h3 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">{title}</h3>
			<ul className="mt-1">{children}</ul>
		</div>
	);
}

/**
 * "When is my day" in one place (ADR-0014): an all-day band, a timeline where
 * timed events and timed tasks share one clock, and everything open that has
 * no hour attached to it — all day and timeline read down the left, open
 * sits in its own column on the right so it doesn't compete with the clock.
 *
 * Owns useOptimistic for complete / reopen / top-3 so checkboxes flip before
 * the full Today RSC round-trip. Projection lives in applyDayIntent.
 */
export function DayBands({
	schedule,
	dateIso,
	todayIso,
	nowUtcIso,
	eventNoteIds,
	taskNoteIds,
}: {
	schedule: DaySchedule;
	/**
	 * The day on screen. Bands derive from it — which tasks are starred for the
	 * day, which have arrived — and ☆ pins to it, so starring while looking at
	 * tomorrow builds tomorrow's shortlist.
	 */
	dateIso: string;
	/**
	 * The real calendar today. Only completion needs it: a recurring task rolls
	 * forward from the wall clock, not from whichever day is being read.
	 */
	todayIso: string;
	/** Wall-clock "now" as UTC ISO — grays out timed events that have ended. */
	nowUtcIso: string;
	/** event id -> linked note id, for the meeting-note affordance on event rows. */
	eventNoteIds?: Record<string, string>;
	/** task id -> linked note id, for the linked-note glyph on task rows. */
	taskNoteIds?: Record<string, string>;
}) {
	const ctx: ApplyContext = { todayIso, top3DateIso: dateIso };
	const [projected, dispatchOptimistic] = useOptimistic(schedule, (current, intent: TaskIntent) =>
		applyDayIntent(current, intent, ctx),
	);
	const run = useTaskIntentRunner(dispatchOptimistic);

	const { allDay, timeline, top3, open } = projected;
	const empty =
		allDay.length === 0 && timeline.length === 0 && top3.length === 0 && open.length === 0;

	const slotsOpen = TOP3_SLOTS - top3.length;

	const writeActions = {
		complete: completeTaskAction,
		reopen: reopenTaskAction,
		setTop3: setTop3Action,
	};

	function handlersFor(task: TaskRow) {
		return bindTaskHandlers(task, run, writeActions, { top3DateIso: dateIso });
	}

	return (
		<section className="mt-14" aria-label="Day schedule">
			{empty ? (
				<p className="py-8 text-center font-serif italic text-ink-3">
					Nothing on the clock. Star tasks or set due dates to shape the day.
				</p>
			) : (
				<div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-14">
					<div className="min-w-0">
						{allDay.length > 0 && (
							<Band title="All day">
								{allDay.map((item) => (
									<ScheduleRow
										key={item.key}
										item={item}
										dateIso={dateIso}
										todayIso={todayIso}
										nowUtcIso={nowUtcIso}
										handlers={item.kind === "task" ? handlersFor(item.task) : undefined}
										noteId={
											item.kind === "event"
												? eventNoteIds?.[item.event.id]
												: taskNoteIds?.[item.task.id]
										}
									/>
								))}
							</Band>
						)}

						{timeline.length > 0 && (
							<Band title="Timeline">
								{timeline.map((item) => (
									<ScheduleRow
										key={item.key}
										item={item}
										dateIso={dateIso}
										todayIso={todayIso}
										nowUtcIso={nowUtcIso}
										handlers={item.kind === "task" ? handlersFor(item.task) : undefined}
										noteId={
											item.kind === "event"
												? eventNoteIds?.[item.event.id]
												: taskNoteIds?.[item.task.id]
										}
									/>
								))}
							</Band>
						)}
					</div>

					<div className="min-w-0">
						<Band title="Top 3">
							{top3.length > 0 ? (
								top3.map((task) => (
									<TaskRowItem
										key={task.id}
										task={task}
										todayIso={todayIso}
										starDateIso={dateIso}
										manageable={false}
										handlers={handlersFor(task)}
										noteId={taskNoteIds?.[task.id]}
									/>
								))
							) : (
								<li className="py-2 font-serif italic text-ink-3">
									Nothing pinned. Star a task to work on it{" "}
									{dateIso === todayIso ? "today" : "then"}.
								</li>
							)}
						</Band>
						{slotsOpen > 0 && (
							<p className="mt-2 font-mono text-meta text-ink-4">
								{slotsOpen} Top 3 slot{slotsOpen === 1 ? "" : "s"} open · tap ☆ on a row to pin
							</p>
						)}

						{open.length > 0 && (
							<Band title="Open">
								{open.map((task) => (
									<TaskRowItem
										key={task.id}
										task={task}
										todayIso={todayIso}
										starDateIso={dateIso}
										manageable={false}
										handlers={handlersFor(task)}
										noteId={taskNoteIds?.[task.id]}
									/>
								))}
							</Band>
						)}
					</div>
				</div>
			)}
		</section>
	);
}
