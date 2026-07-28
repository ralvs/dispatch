import type { DaySchedule as DayScheduleView } from "@/lib/services/briefing";
import { DaySchedule } from "./day-schedule";
import { DayTape } from "./day-tape";

// The day tape + schedule list, split out of briefing-body so the two most
// time-sensitive widgets (both read off todayEvents/open tasks, the fast
// segment of getBriefing) can be reasoned about — and Suspended — on their
// own if that segment is ever split out at the call site.
export function DayScheduleSection({
	schedule,
	todayIso,
	nowUtcIso,
	nowLabel,
	eventNoteIds,
	taskNoteIds,
}: {
	schedule: DayScheduleView;
	todayIso: string;
	nowUtcIso: string;
	nowLabel: string;
	eventNoteIds?: Record<string, string>;
	taskNoteIds?: Record<string, string>;
}) {
	return (
		<>
			<DayTape
				timeline={schedule.timeline}
				todayIso={todayIso}
				nowLabel={nowLabel}
				nowUtcIso={nowUtcIso}
			/>
			<DaySchedule
				schedule={schedule}
				todayIso={todayIso}
				nowUtcIso={nowUtcIso}
				eventNoteIds={eventNoteIds}
				taskNoteIds={taskNoteIds}
			/>
		</>
	);
}
