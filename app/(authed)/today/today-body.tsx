import type { SupabaseClient } from "@supabase/supabase-js";
import { calendarHealth } from "@/lib/calendar-health";
import { readCalendarSyncStates } from "@/lib/services/calendar";
import { Seed } from "@/lib/store/seed";
import { createAdminClient } from "@/lib/supabase/admin";
import { CalendarHealthLine } from "./calendar-health-line";
import { Counters } from "./counters";
import { DayView } from "./day-view";
import { ProjectsCard } from "./projects-card";
import { ResurfacedQuote } from "./resurfaced-quote";
import { RoutinesCard } from "./routines-card";
import { readToday } from "./today-snapshots";
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
	const [{ view, digest, snapshot, digestSnapshot }, syncStates] = await Promise.all([
		readToday(sb, tz, todayIso, selectedIso, nowMs),
		// Request-fresh, not cached: staleness is measured against now, and the
		// CalDAV cron busts no tag on a quiet tick. Service client because both
		// singletons are RLS-on with no policy; page.tsx ran the owner check.
		// A failed read only loses the line, never the page.
		readCalendarSyncStates(createAdminClient()).catch((error) => {
			console.error("[today] calendar sync state read failed", error);
			return { work: null, icloud: null };
		}),
	]);

	return (
		<Seed snapshot={snapshot}>
			<Seed snapshot={digestSnapshot}>
				<TodayStyles />
				<DayView
					dateIso={selectedIso}
					todayIso={todayIso}
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
					calendarHealth={
						<CalendarHealthLine
							health={calendarHealth(syncStates, nowMs)}
							tz={tz}
							todayIso={todayIso}
						/>
					}
					aside={
						<>
							<RoutinesCard nowMs={nowMs} />
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
			</Seed>
		</Seed>
	);
}
