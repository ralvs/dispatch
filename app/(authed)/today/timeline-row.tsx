import type { DayScheduleItem } from "@/lib/services/briefing";
import { type TaskRowHandlers, TaskRowItem } from "../tasks/task-row";

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
function EventRow({
	item,
	past,
}: {
	item: Extract<DayScheduleItem, { kind: "event" }>;
	past: boolean;
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
		</li>
	);
}

/**
 * One row of a schedule band. Events carry their own chrome; tasks reuse the
 * Tasks-page row so complete and top-3 behave identically wherever they appear.
 */
export function ScheduleRow({
	item,
	todayIso,
	handlers,
	nowUtcIso,
}: {
	item: DayScheduleItem;
	todayIso: string;
	handlers?: TaskRowHandlers;
	/** Used to gray out timed events that have already ended. */
	nowUtcIso?: string;
}) {
	if (item.kind === "task") {
		if (!handlers) return null;
		return (
			<TaskRowItem
				task={item.task}
				todayIso={todayIso}
				timeLabel={item.time}
				manageable={false}
				handlers={handlers}
			/>
		);
	}
	const past = Boolean(nowUtcIso && item.event.end_at < nowUtcIso);
	return <EventRow item={item} past={past} />;
}
