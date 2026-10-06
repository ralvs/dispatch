import { calendarDaysBetween, dateOfInstant, formatInstant } from "@/lib/dates";

// Is each calendar feed current? (#96, docs/adr/0080). An empty day and a
// calendar that stopped syncing look the same on Today; this tells them apart.
//
// Two feeds, each with a singleton sync-state row:
//   work    google_sync_state — the Mac EventKit bridge pushes every 15 min
//           (docs/adr/0018). Most of its failures never reach the server (the
//           Mac is asleep or offline), so only the age of the last success
//           shows them.
//   icloud  caldav_sync_state — the CalDAV cron pulls every few minutes. A
//           failed run writes `{ error }` into `last_result`.
//
// A feed with no row has never synced: it is not set up, so it says nothing.

export type CalendarFeed = "work" | "icloud";

/** One sync-state row, as stored. */
export type SyncState = { last_synced_at: string | null; last_result: unknown };

export type FeedHealth = {
	feed: CalendarFeed;
	/** `failed`: the last run failed. `stale`: no success for STALE_AFTER_MS. */
	status: "failed" | "stale";
	/** When the last run happened (failed) or last succeeded (stale), UTC. */
	at: string;
};

/** Eight missed bridge runs. Less than that is a blip, not a stale calendar. */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function lastError(result: unknown): string | null {
	if (result && typeof result === "object" && "error" in result) {
		const { error } = result as { error: unknown };
		return typeof error === "string" ? error : "failed";
	}
	return null;
}

function feedHealth(feed: CalendarFeed, state: SyncState | null, nowMs: number): FeedHealth | null {
	if (!state?.last_synced_at) return null;
	if (lastError(state.last_result) !== null) {
		return { feed, status: "failed", at: state.last_synced_at };
	}
	if (nowMs - Date.parse(state.last_synced_at) > STALE_AFTER_MS) {
		return { feed, status: "stale", at: state.last_synced_at };
	}
	return null;
}

/** The feeds that need a word on Today. Empty on a healthy day. */
export function calendarHealth(
	states: { work: SyncState | null; icloud: SyncState | null },
	nowMs: number,
): FeedHealth[] {
	return [
		feedHealth("work", states.work, nowMs),
		feedHealth("icloud", states.icloud, nowMs),
	].filter((h): h is FeedHealth => h !== null);
}

const FEED_NAME: Record<CalendarFeed, string> = {
	work: "Work calendar",
	icloud: "iCloud calendar",
};

/** `at 14:10` today, `Fri 18:04` this week, `12 Sep, 18:04` before that. */
function when(utcIso: string, tz: string, todayIso: string): string {
	const days = calendarDaysBetween(dateOfInstant(utcIso, tz), todayIso);
	if (days === 0) return `at ${formatInstant(utcIso, tz, "HH:mm")}`;
	if (days < 7) return formatInstant(utcIso, tz, "ccc HH:mm");
	return formatInstant(utcIso, tz, "d LLL, HH:mm");
}

/** The sentence Today prints for one feed. */
export function describeFeedHealth(health: FeedHealth, tz: string, todayIso: string): string {
	const name = FEED_NAME[health.feed];
	const at = when(health.at, tz, todayIso);
	if (health.status === "failed") return `${name} sync failed ${at}.`;
	// The bridge cannot be pulled from here: the Mac sends, the server waits.
	if (health.feed === "work")
		return `${name} last synced ${at}. The Mac bridge has not reported since.`;
	return `${name} last synced ${at}.`;
}
