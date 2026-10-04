import { calendarDaysBetween, shiftDay } from "@/lib/dates";

// Streak + completion-rate math for routines.
//
// Pure function over a set of YYYY-MM-DD completion dates. No DB access,
// no timezone fuss — the caller is responsible for choosing what "today"
// means in the app timezone (lib/dates.ts) and passing it in.
//
// Why pure: the server computes these on read so the daily UI shows current
// numbers, and the heatmap view re-derives them from the same data so we
// can't drift between two surfaces.

/**
 * The window the routine row's grid draws, and therefore the window a
 * completion may be backfilled into (docs/adr/0054, plan O4). One constant so
 * the squares on screen and the dates the server accepts cannot drift apart.
 *
 * It lives here rather than beside the action because a "use server" module
 * may only export async functions — a plain const there makes every export in
 * the file unreachable, silently, until the production build says so.
 */
export const BACKFILL_DAYS = 30;

/**
 * How far back a routine's completion log is read — for streaks long enough
 * to matter, and past the BACKFILL_DAYS grid. Today and /routines read the
 * same window, so a streak reads the same on both.
 */
export const ROUTINE_HISTORY_DAYS = 60;

/** Attach each routine's completion dates, ascending. Rows keep their order. */
export function withHistory<R extends { id: string }>(
	routines: R[],
	completions: Array<{ routine_id: string; completed_date: string }>,
): Array<R & { completions: string[] }> {
	const byRoutine = new Map<string, string[]>();
	for (const c of completions) {
		const dates = byRoutine.get(c.routine_id);
		if (dates) dates.push(c.completed_date);
		else byRoutine.set(c.routine_id, [c.completed_date]);
	}
	return routines.map((r) => ({
		...r,
		completions: (byRoutine.get(r.id) ?? []).sort(),
	}));
}

export interface RoutineStats {
	// Days completed in a consecutive run ending today (or yesterday if
	// today isn't done yet but yesterday was). 0 if no current run.
	current_streak: number;
	// Longest consecutive run anywhere in history. >= current_streak.
	longest_streak: number;
	// Completions in the last 7 / 30 days (counting today).
	completions_7d: number;
	completions_30d: number;
	// Total completions across all time.
	total: number;
	// Whether today specifically has a completion. Used by the daily widget.
	done_today: boolean;
}

// Given a set of completion dates and "today", compute the stats above.
// completionDates can be any order; we materialize a Set for O(1) hits.
export function computeRoutineStats(
	completionDates: readonly string[],
	todayIso: string,
): RoutineStats {
	const set = new Set(completionDates);

	// ── Current streak ─────────────────────────────────────────────────
	// Walk backwards from today. If today isn't done, start from yesterday
	// — a streak isn't broken until you miss a full day. If yesterday also
	// isn't done, the current streak is 0.
	let current = 0;
	let cursor = todayIso;
	if (!set.has(cursor)) {
		const prev = shiftDay(cursor, -1);
		if (!set.has(prev)) {
			current = 0;
		} else {
			cursor = prev;
		}
	}
	while (set.has(cursor)) {
		current += 1;
		cursor = shiftDay(cursor, -1);
	}

	// ── Longest streak ─────────────────────────────────────────────────
	// Sort completions, walk forward, count consecutive runs.
	const sorted = [...completionDates].sort();
	let longest = 0;
	let run = 0;
	let prev: string | null = null;
	for (const d of sorted) {
		if (prev !== null && calendarDaysBetween(prev, d) === 1) {
			run += 1;
		} else {
			run = 1;
		}
		if (run > longest) longest = run;
		prev = d;
	}

	// ── 7-day / 30-day windows ────────────────────────────────────────
	// Inclusive of today, going backwards.
	let completions_7d = 0;
	let completions_30d = 0;
	for (const d of completionDates) {
		// A future date is outside both windows (YYYY-MM-DD sorts as text).
		if (d > todayIso) continue;
		const gap = calendarDaysBetween(d, todayIso);
		if (gap < 7) completions_7d += 1;
		if (gap < 30) completions_30d += 1;
	}

	return {
		current_streak: current,
		longest_streak: longest,
		completions_7d,
		completions_30d,
		total: completionDates.length,
		done_today: set.has(todayIso),
	};
}

// 30-cell calendar grid for the detail-page heatmap. Returns the last
// 30 days oldest-first so the UI can render left-to-right.
export function recentDaysGrid(
	completionDates: readonly string[],
	todayIso: string,
	days: number = 30,
): Array<{ date: string; done: boolean; isToday: boolean }> {
	const set = new Set(completionDates);
	const out: Array<{ date: string; done: boolean; isToday: boolean }> = [];
	for (let i = days - 1; i >= 0; i--) {
		const date = shiftDay(todayIso, -i);
		out.push({ date, done: set.has(date), isToday: i === 0 });
	}
	return out;
}
