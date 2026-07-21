import Link from "next/link";
import type { DaySchedule as DayScheduleData } from "@/lib/services/briefing";
import { isTop3Today } from "@/lib/task-predicates";
import { type TaskDomainOption, TaskRowItem } from "../tasks/task-row";
import { ScheduleRow } from "./timeline-row";

const TOP3_SLOTS = 3;

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
 */
export function DaySchedule({
	schedule,
	todayIso,
	openCount,
	overdueCount,
	domains,
}: {
	schedule: DayScheduleData;
	todayIso: string;
	openCount: number;
	overdueCount: number;
	domains: TaskDomainOption[];
}) {
	const { allDay, timeline, open } = schedule;
	const empty = allDay.length === 0 && timeline.length === 0 && open.length === 0;

	const starred = [
		...allDay.filter((i) => i.kind === "task" && isTop3Today(i.task, todayIso)),
		...timeline.filter((i) => i.kind === "task" && isTop3Today(i.task, todayIso)),
		...open.filter((t) => isTop3Today(t, todayIso)),
	].length;
	const slotsOpen = TOP3_SLOTS - starred;

	return (
		<section className="mt-14" aria-label="Day schedule">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					The day · {openCount} open
					{overdueCount > 0 && <span className="text-accent"> · {overdueCount} overdue</span>}
				</h2>
				<Link href="/tasks" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All tasks →
				</Link>
			</div>

			{empty ? (
				<p className="py-8 text-center font-serif italic text-ink-3">
					Nothing on the clock. Star tasks or set due dates to shape the day.
				</p>
			) : (
				<div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-14">
					<div className="min-w-0">
						{allDay.length > 0 && (
							<Band title="All day">
								{allDay.map((item) => (
									<ScheduleRow key={item.key} item={item} todayIso={todayIso} domains={domains} />
								))}
							</Band>
						)}

						{timeline.length > 0 && (
							<Band title="Timeline">
								{timeline.map((item) => (
									<ScheduleRow key={item.key} item={item} todayIso={todayIso} domains={domains} />
								))}
							</Band>
						)}
					</div>

					<div className="min-w-0">
						<Band title="Open">
							{open.length > 0 ? (
								open.map((task) => (
									<TaskRowItem key={task.id} task={task} todayIso={todayIso} domains={domains} />
								))
							) : (
								<li className="py-2 font-serif italic text-ink-3">
									Nothing pinned. Star a task to work on it today.
								</li>
							)}
						</Band>
						{slotsOpen > 0 && (
							<p className="mt-2 font-mono text-meta text-ink-4">
								{slotsOpen} Top 3 slot{slotsOpen === 1 ? "" : "s"} open · tap ☆ on a row to pin
							</p>
						)}
					</div>
				</div>
			)}
		</section>
	);
}
