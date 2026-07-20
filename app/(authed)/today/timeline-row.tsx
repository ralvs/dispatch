import type { DayScheduleItem } from "@/lib/services/briefing";
import { TaskRowItem } from "../tasks/task-row";

function EventRow({ item }: { item: Extract<DayScheduleItem, { kind: "event" }> }) {
	const { event, time } = item;
	const meta = [event.calendar_name, event.location].filter(Boolean).join(" · ");

	return (
		<li className="hairline flex items-baseline gap-3 py-2.5">
			<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
				{time ?? "—"}
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm text-ink">{event.title}</p>
				{meta && <p className="mt-0.5 truncate font-mono text-meta text-ink-4">{meta}</p>}
			</div>
			<span className="shrink-0 self-center font-mono text-eyebrow uppercase tracking-widest text-ink-4">
				Event
			</span>
		</li>
	);
}

/**
 * One row of a schedule band. Events carry their own chrome; tasks reuse the
 * Tasks-page row so complete and top-3 behave identically wherever they
 * appear — `timeLabel` is what puts it on the clock (null = all-day band).
 */
export function ScheduleRow({ item, todayIso }: { item: DayScheduleItem; todayIso: string }) {
	if (item.kind === "task") {
		return <TaskRowItem task={item.task} todayIso={todayIso} timeLabel={item.time} />;
	}
	return <EventRow item={item} />;
}
