import type { DayScheduleItem } from "@/lib/services/briefing";
import { type TaskDomainOption, TaskRowItem } from "../tasks/task-row";

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

// The calendar icon is what says "this is an event, not a task" — it sits in
// the checkbox's column so events and tasks line up in the same band.
function EventRow({ item }: { item: Extract<DayScheduleItem, { kind: "event" }> }) {
	const { event, time } = item;
	const meta = [event.calendar_name, event.location].filter(Boolean).join(" · ");

	return (
		<li className="hairline flex items-baseline gap-3 py-2.5">
			{time && (
				<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">{time}</span>
			)}
			<IconCalendar className="h-4 w-4 shrink-0 self-center text-ink-3" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm text-ink">{event.title}</p>
				{meta && <p className="mt-0.5 truncate font-mono text-meta text-ink-4">{meta}</p>}
			</div>
		</li>
	);
}

/**
 * One row of a schedule band. Events carry their own chrome; tasks reuse the
 * Tasks-page row so complete, edit, delete, and top-3 behave identically
 * wherever they appear — `timeLabel` is what puts it on the clock
 * (null = all-day band).
 */
export function ScheduleRow({
	item,
	todayIso,
	domains,
}: {
	item: DayScheduleItem;
	todayIso: string;
	domains: TaskDomainOption[];
}) {
	if (item.kind === "task") {
		return (
			<TaskRowItem task={item.task} todayIso={todayIso} timeLabel={item.time} domains={domains} />
		);
	}
	return <EventRow item={item} />;
}
