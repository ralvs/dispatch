import type { DaySchedule as DayScheduleView } from "@/lib/services/briefing";
import { DayNav } from "./day-nav";
import { DaySchedule } from "./day-schedule";
import { DayTape } from "./day-tape";

// The day tape + schedule list, split out of briefing-body so the two most
// time-sensitive widgets (both read off todayEvents/open tasks, the fast
// segment of getBriefing) can be reasoned about — and Suspended — on their
// own if that segment is ever split out at the call site.
//
// The day navigation sits at the head of this section because it governs the
// whole of it: one control moves the tape, the timeline and the task column
// together, which only reads honestly if it sits above all three.
export function DayScheduleSection({
	schedule,
	dateIso,
	todayIso,
	nowUtcIso,
	nowLabel,
	eventNoteIds,
	taskNoteIds,
}: {
	schedule: DayScheduleView;
	/** The day on screen. Equals todayIso unless the day nav has moved. */
	dateIso: string;
	todayIso: string;
	nowUtcIso: string;
	/** Null on any day but today — there is no "now" to mark on another day. */
	nowLabel: string | null;
	eventNoteIds?: Record<string, string>;
	taskNoteIds?: Record<string, string>;
}) {
	return (
		<>
			<DayTape
				timeline={schedule.timeline}
				dateIso={dateIso}
				nowLabel={nowLabel}
				nowUtcIso={nowUtcIso}
				nav={<DayNav dateIso={dateIso} todayIso={todayIso} />}
			/>
			<DaySchedule
				schedule={schedule}
				dateIso={dateIso}
				todayIso={todayIso}
				nowUtcIso={nowUtcIso}
				eventNoteIds={eventNoteIds}
				taskNoteIds={taskNoteIds}
			/>
		</>
	);
}
