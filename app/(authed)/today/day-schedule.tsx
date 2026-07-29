"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { DaySchedule as DayScheduleData, DayScheduleItem } from "@/lib/services/briefing";
import type { TaskRow } from "@/lib/services/tasks";
import {
	type ApplyContext,
	applyOpenTaskList,
	type TaskIntent,
} from "@/lib/task-interaction/apply-intent";
import { isTop3Today, TOP3_SLOTS } from "@/lib/task-predicates";
import { completeTaskAction, reopenTaskAction, toggleTop3Action } from "../tasks/actions";
import { TaskRowItem } from "../tasks/task-row";
import { ScheduleRow } from "./timeline-row";

function Band({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-8">
			<h3 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">{title}</h3>
			<ul className="mt-1">{children}</ul>
		</div>
	);
}

function collectOpenTasks(schedule: DayScheduleData): TaskRow[] {
	const byId = new Map<string, TaskRow>();
	for (const item of schedule.allDay) {
		if (item.kind === "task") byId.set(item.task.id, item.task);
	}
	for (const item of schedule.timeline) {
		if (item.kind === "task") byId.set(item.task.id, item.task);
	}
	for (const task of schedule.top3) {
		byId.set(task.id, task);
	}
	for (const task of schedule.open) {
		byId.set(task.id, task);
	}
	return [...byId.values()];
}

function projectSchedule(
	schedule: DayScheduleData,
	open: TaskRow[],
	dateIso: string,
): DayScheduleData {
	const byId = new Map(open.map((t) => [t.id, t]));

	function mapItems(items: DayScheduleItem[]): DayScheduleItem[] {
		const out: DayScheduleItem[] = [];
		for (const item of items) {
			if (item.kind !== "task") {
				out.push(item);
				continue;
			}
			const next = byId.get(item.task.id);
			if (!next || next.status === "done") continue;
			out.push({ ...item, task: next });
		}
		return out;
	}

	// Top 3 re-derives from the optimistic list rather than from schedule.top3,
	// so tapping ☆ on any band moves the row into (or out of) the shortlist
	// immediately instead of waiting for the briefing RSC round-trip.
	const top3 = open.filter((t) => t.status === "open" && isTop3Today(t, dateIso));

	// Open carries the leftovers only — a row promoted to Top 3 leaves this band
	// in the same tick it joins that one, so it never shows up twice.
	const openBand: TaskRow[] = [];
	for (const t of schedule.open) {
		const next = byId.get(t.id);
		if (next && next.status === "open" && !isTop3Today(next, dateIso)) openBand.push(next);
	}

	return {
		allDay: mapItems(schedule.allDay),
		timeline: mapItems(schedule.timeline),
		top3,
		open: openBand,
	};
}

/**
 * "When is my day" in one place (ADR-0014): an all-day band, a timeline where
 * timed events and timed tasks share one clock, and everything open that has
 * no hour attached to it — all day and timeline read down the left, open
 * sits in its own column on the right so it doesn't compete with the clock.
 *
 * Owns useOptimistic for complete / reopen / top-3 so checkboxes flip before
 * the full briefing RSC round-trip.
 */
export function DaySchedule({
	schedule,
	dateIso,
	todayIso,
	nowUtcIso,
	eventNoteIds,
	taskNoteIds,
}: {
	schedule: DayScheduleData;
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
	/** task id -> linked note id, for the "¶ Note" chip on task rows. */
	taskNoteIds?: Record<string, string>;
}) {
	const [, startTransition] = useTransition();
	const seed = useMemo(() => collectOpenTasks(schedule), [schedule]);
	const ctx: ApplyContext = { todayIso, top3DateIso: dateIso };

	const [openTasks, dispatchOptimistic] = useOptimistic(seed, (current, intent: TaskIntent) =>
		applyOpenTaskList(current, intent, ctx),
	);

	const projected = useMemo(
		() => projectSchedule(schedule, openTasks, dateIso),
		[schedule, openTasks, dateIso],
	);

	const { allDay, timeline, top3, open } = projected;
	const empty =
		allDay.length === 0 && timeline.length === 0 && top3.length === 0 && open.length === 0;

	const slotsOpen = TOP3_SLOTS - top3.length;

	function run(intent: TaskIntent, action: () => Promise<void>) {
		startTransition(async () => {
			dispatchOptimistic(intent);
			await runAction(action, "Couldn't update that task. Try again.");
		});
	}

	function handlersFor(task: TaskRow) {
		const done = task.status === "done";
		return {
			onToggleDone: () => {
				if (done) {
					run({ type: "reopen", id: task.id }, () => reopenTaskAction(task.id));
				} else {
					run({ type: "complete", id: task.id }, () => completeTaskAction(task.id));
				}
			},
			onToggleTop3: () => {
				run({ type: "toggleTop3", id: task.id }, () => toggleTop3Action(task.id, dateIso));
			},
		};
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
