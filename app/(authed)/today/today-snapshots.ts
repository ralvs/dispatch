import "server-only";
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
import type { Snapshot } from "@/lib/store/types";

/**
 * Everything Today reads, as the two entity-store snapshots it seeds. One
 * function for the page render and for the 5-minute pull
 * (app/(authed)/today/soft-refresh.tsx, #4), so the two cannot disagree about what
 * Today shows.
 */
export async function readToday(
	sb: SupabaseClient,
	tz: string,
	todayIso: string,
	selectedIso: string,
	nowMs: number,
) {
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
			"events.today": view.anchor.eventCount,
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
		aggregates: {
			"notifications.unread": view.masthead.unreadNotifications,
			"notes.needsReview": view.needsReviewCount,
			// The projects card's rings (#31): a tick anywhere moves them.
			...Object.fromEntries(
				view.projects.flatMap((p) => [
					[`project.done:${p.id}`, p.doneCount],
					[`project.open:${p.id}`, p.totalCount - p.doneCount],
				]),
			),
		},
	};

	return { view, digest, snapshot, digestSnapshot };
}
