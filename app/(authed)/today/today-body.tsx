import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedTodayDigest } from "@/lib/cache/today";
import {
	assembleTodayView,
	loadDayScheduleInputs,
	loadDaySchedulePayload,
} from "@/lib/services/today";
import { Counters } from "./counters";
import { DayView } from "./day-view";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";
import { TodayStyles } from "./today-styles";

/**
 * Everything on Today that needs the view read. page.tsx Suspends this so the
 * shell paints first. Chrome is cross-request cached; schedule inputs stay
 * request-fresh for SoftRefresh honesty (docs/adr/0033).
 *
 * The page reads top down: dateline → headline → counters → all-day band → day
 * tape → then the stack, which is Timeline / Open / Resurfaced beside Top 3 /
 * Routines / Projects on desktop, and one orientation-first column on a phone.
 *
 * DayView owns that whole composition because everything above the stack
 * follows the day nav, and the stack has to be a single tree for the phone
 * reorder to work. The three sections that do NOT follow the day — the
 * counters, the two cards, the quote — are rendered here on the server and
 * passed in as slots.
 */
export async function TodayBody({
	sb,
	tz,
	todayIso,
	selectedIso,
}: {
	sb: SupabaseClient;
	tz: string;
	todayIso: string;
	/** The day the schedule shows. Everything else on Today is today's. */
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
		{ todayIso, nowMs, schedule: isToday ? view.daySchedule : undefined },
	);

	return (
		<>
			<TodayStyles />
			<DayView
				schedule={schedule}
				dateIso={selectedIso}
				todayIso={todayIso}
				tz={tz}
				nowUtcIso={nowUtcIso}
				nowLabel={nowLabel}
				eventNoteIds={eventNoteIds}
				taskNoteIds={taskNoteIds}
				domains={digest.domains.map((d) => ({ name: d.name, color: d.color }))}
				counters={
					<Counters
						events={view.anchor.eventCount}
						open={view.anchor.openCount}
						overdue={view.anchor.overdueCount}
						inbox={view.inboxCount}
						needsReview={view.needsReviewCount}
						notifications={view.masthead.unreadNotifications}
					/>
				}
				aside={
					<>
						<RoutinesCard
							buckets={view.routineBuckets}
							done={view.routines.done}
							total={view.routines.total}
						/>
						<ProjectsCard projects={view.projects} />
					</>
				}
				quote={
					<ResurfacedQuote
						quote={view.resurfaced}
						skips={view.resurfacedSkips}
						hasQuotes={view.latestQuote !== null}
					/>
				}
			/>
		</>
	);
}
