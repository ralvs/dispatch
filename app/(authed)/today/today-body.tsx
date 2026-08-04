import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedTodayDigest } from "@/lib/cache/today";
import {
	assembleTodayView,
	loadDayScheduleInputs,
	loadDaySchedulePayload,
} from "@/lib/services/today";
import { AlertsRow } from "./alerts-row";
import { AnchorLine } from "./anchor-line";
import { BriefSection } from "./brief-section";
import { DayView } from "./day-view";
import { LatestQuote } from "./latest-quote";
import { Masthead } from "./masthead";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";

// Everything on Today that needs the view read. page.tsx Suspends this
// so the shell paints first. Chrome is cross-request cached; schedule inputs
// stay request-fresh for SoftRefresh honesty (docs/adr/0033).
export async function TodayBody({
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
	const [{ open, completed, events: todayEvents }, digest] = await Promise.all([
		loadDayScheduleInputs(sb, tz, todayIso),
		getCachedTodayDigest(todayIso),
	]);
	const view = assembleTodayView(digest, open, todayEvents, tz, todayIso, nowMs, completed);
	const isToday = selectedIso === todayIso;

	// The default view already has today's bands from assemble; only a day
	// navigated away pays for the second read. Note-id maps share one helper
	// with loadDayScheduleAction so SSR and day-nav cannot drift.
	const { schedule, nowUtcIso, nowLabel, eventNoteIds, taskNoteIds } = await loadDaySchedulePayload(
		sb,
		tz,
		selectedIso,
		{
			todayIso,
			nowMs,
			schedule: isToday ? view.daySchedule : undefined,
		},
	);

	const showLatestQuote = view.latestQuote !== null && view.latestQuote.id !== view.resurfaced?.id;

	return (
		<>
			<Masthead todayIso={todayIso} unreadNotifications={view.masthead.unreadNotifications} />

			{/* The day at a glance: the anchor sentence already carries the
			 * counts, so it stands alone rather than repeating them as a strip
			 * of big numbers — Awaiting decision fills the row beside it,
			 * vertically centered against whichever side runs taller. */}
			<div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-center lg:gap-14">
				<AnchorLine anchor={view.anchor} tz={tz} />
				<AlertsRow
					inbox={view.inboxCount}
					needsReview={view.needsReviewCount}
					linksUnread={view.linksUnreadCount}
				/>
			</div>

			<DayView
				schedule={schedule}
				dateIso={selectedIso}
				todayIso={todayIso}
				tz={tz}
				nowUtcIso={nowUtcIso}
				nowLabel={nowLabel}
				eventNoteIds={eventNoteIds}
				taskNoteIds={taskNoteIds}
			/>

			<div className="mt-14 grid grid-cols-1 gap-14 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-x-10">
				<div className="min-w-0">
					<BriefSection lines={view.briefLines} />
					<ResurfacedQuote
						quote={view.resurfaced}
						skips={view.resurfacedSkips}
						hasQuotes={view.latestQuote !== null}
					/>
					{showLatestQuote && view.latestQuote && <LatestQuote quote={view.latestQuote} />}
				</div>

				<div className="min-w-0">
					<RoutinesCard
						buckets={view.routineBuckets}
						done={view.routines.done}
						total={view.routines.total}
					/>
					<ProjectsCard projects={view.projects} />
				</div>
			</div>
		</>
	);
}
