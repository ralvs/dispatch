import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedBriefingChrome } from "@/lib/cache/briefing";
import { formatInstant } from "@/lib/dates";
import { assembleBriefing, getDaySchedule, loadDayScheduleInputs } from "@/lib/services/briefing";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { AlertsRow } from "./alerts-row";
import { AnchorLine } from "./anchor-line";
import { BriefSection } from "./brief-section";
import { DayScheduleSection } from "./day-schedule-section";
import { LatestQuote } from "./latest-quote";
import { Masthead } from "./masthead";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";

// Everything on Today that needs the briefing read. page.tsx Suspends this
// so the shell paints first. Chrome is cross-request cached; schedule inputs
// stay request-fresh for SoftRefresh honesty (docs/adr/0033).
export async function BriefingBody({
	sb,
	tz,
	todayIso,
	selectedIso,
}: {
	sb: SupabaseClient;
	tz: string;
	todayIso: string;
	/** The day the schedule section shows. Everything else on Today is today's. */
	selectedIso: string;
}) {
	const nowMs = Date.now();
	const [{ open, events: todayEvents }, chrome] = await Promise.all([
		loadDayScheduleInputs(sb, tz, todayIso),
		getCachedBriefingChrome(todayIso),
	]);
	const briefing = assembleBriefing(chrome, open, todayEvents, tz, todayIso, nowMs);
	const nowUtcIso = new Date(nowMs).toISOString();
	const isToday = selectedIso === todayIso;

	// The default view already has today's bands from assemble; only a day
	// navigated away pays for the second read (also cacheable by date).
	const schedule = isToday ? briefing.daySchedule : await getDaySchedule(sb, tz, selectedIso);

	const eventIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "event")
		.map((item) => item.event.id);

	// Every task Today can render a row for: the scheduled bands (all day +
	// timeline), Top 3, and Open — deduped into one id list so the note-link
	// lookup below stays a single batched call.
	const scheduledTaskIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "task")
		.map((item) => item.task.id);
	const taskIds = [
		...new Set([
			...scheduledTaskIds,
			...schedule.top3.map((task) => task.id),
			...schedule.open.map((task) => task.id),
		]),
	];

	const [eventNoteIds, taskNoteIds] = await Promise.all([
		listNoteIdsForTargets(sb, "event", eventIds).then((map) => Object.fromEntries(map)),
		listNoteIdsForTargets(sb, "task", taskIds).then((map) => Object.fromEntries(map)),
	]);

	const showLatestQuote =
		briefing.latestQuote !== null && briefing.latestQuote.id !== briefing.resurfaced?.id;

	return (
		<>
			<Masthead todayIso={todayIso} unreadNotifications={briefing.masthead.unreadNotifications} />

			{/* The day at a glance: the anchor sentence already carries the
			 * counts, so it stands alone rather than repeating them as a strip
			 * of big numbers — Awaiting decision fills the row beside it,
			 * vertically centered against whichever side runs taller. */}
			<div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:gap-14">
				<AnchorLine anchor={briefing.anchor} tz={tz} />
				<AlertsRow
					inbox={briefing.inboxCount}
					needsReview={briefing.needsReviewCount}
					linksUnread={briefing.linksUnreadCount}
				/>
			</div>

			<DayScheduleSection
				schedule={schedule}
				dateIso={selectedIso}
				todayIso={todayIso}
				nowUtcIso={nowUtcIso}
				nowLabel={isToday ? formatInstant(nowUtcIso, tz, "HH:mm") : null}
				eventNoteIds={eventNoteIds}
				taskNoteIds={taskNoteIds}
			/>

			<div className="mt-14 grid grid-cols-1 gap-14 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-x-10">
				<div className="min-w-0">
					<BriefSection lines={briefing.briefLines} />
					<ResurfacedQuote
						quote={briefing.resurfaced}
						skips={briefing.resurfacedSkips}
						hasQuotes={briefing.latestQuote !== null}
					/>
					{showLatestQuote && briefing.latestQuote && <LatestQuote quote={briefing.latestQuote} />}
				</div>

				<div className="min-w-0">
					<RoutinesCard
						buckets={briefing.routineBuckets}
						done={briefing.routines.done}
						total={briefing.routines.total}
					/>
					<ProjectsCard projects={briefing.projects} />
				</div>
			</div>
		</>
	);
}
