import type { SupabaseClient } from "@supabase/supabase-js";
import { getCachedTodayDigest } from "@/lib/cache/today";
import { nowUtc } from "@/lib/dates";
import { withHistory } from "@/lib/routine-stats";
import {
	assembleTodayView,
	loadDayScheduleInputs,
	loadDaySchedulePayload,
} from "@/lib/services/today";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
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
	// The entity store's version for everything read below (lib/store/types.ts),
	// stamped before the first read starts.
	const readAt = nowUtc(nowMs);
	const [{ open, completed, events: todayEvents }, digest] = await Promise.all([
		loadDayScheduleInputs(sb, tz, todayIso),
		getCachedTodayDigest(todayIso),
	]);
	const view = assembleTodayView(digest, open, todayEvents, tz, todayIso, nowMs, completed);
	const isToday = selectedIso === todayIso;

	// The default view already has today's bands from assemble; only a day
	// navigated away pays for the second read. Note-id maps share one helper
	// with loadDayScheduleAction so SSR and day-nav cannot drift.
	const day = await loadDaySchedulePayload(sb, tz, selectedIso, {
		todayIso,
		nowMs,
		schedule: isToday ? view.daySchedule : undefined,
	});

	// The day's rows and today's task counts go to the entity store (#26), so
	// a tick anywhere moves them without a page render. Today is locked to the
	// real today (ADR-0036).
	const snapshot: Snapshot = {
		readAt,
		todayIso,
		tz,
		views: [{ key: viewKey.day(selectedIso), type: "day", data: day }],
		aggregates: {
			"tasks.open": view.anchor.openCount,
			"tasks.overdue": view.anchor.overdueCount,
			"tasks.inbox": view.inboxCount,
		},
	};
	// What comes from the cached digest carries the digest's own stamp, not
	// `readAt` above: a stale entry must stay older than the write it missed
	// (#28). Its own Seed, inside the first, so both reach every consumer.
	const digestSnapshot: Snapshot = {
		readAt: digest.readAt,
		todayIso,
		tz,
		// The routines card's rows (#29): the same view /routines reads.
		views: [
			{
				key: viewKey.routines(),
				type: "routineList",
				data: withHistory(digest.routines, digest.completionHistory),
			},
		],
		aggregates: { "notifications.unread": view.masthead.unreadNotifications },
	};

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
