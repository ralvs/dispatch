// Today's routines card, grouped by time of day. Pure and client-safe: the
// card derives it from the entity store (#29).

import { instantFromLocal, isWallClockTime } from "@/lib/dates";
import { computeRoutineStats, type RoutineStats, recentDaysGrid } from "@/lib/routine-stats";
import type { CompletionRow, RoutineRow } from "@/lib/schemas/routine";

export type RoutineBucketRow = {
	id: string;
	name: string;
	done: boolean;
	streak: number;
	/**
	 * The last seven days, oldest first — the streak trail beside each row.
	 * A number is a claim you have to trust; seven squares are the evidence
	 * for it, and they show the shape of a habit a streak count flattens
	 * (six-on-one-off reads as 0 as a streak and as a rhythm as a trail).
	 */
	trail: boolean[];
	specificTime: string | null;
	reminderEnabled: boolean;
	missed: boolean;
};

export type RoutineBucket = {
	bucket: RoutineRow["time_of_day"];
	rows: RoutineBucketRow[];
};

/**
 * Clock-derived "missed" flag: a routine with a specific time whose time has
 * already passed today and isn't done. Purely a display signal — no DB write,
 * no cron (routines.last_missed_sent_date has no producer and stays that way).
 * Defensive like taskDueInstant: a malformed time degrades to false instead
 * of throwing.
 */
function isRoutineMissed(
	specificTime: string | null,
	done: boolean,
	todayIso: string,
	tz: string,
	nowMs: number,
): boolean {
	if (done || specificTime === null || !isWallClockTime(specificTime)) return false;
	try {
		return Date.parse(instantFromLocal(todayIso, specificTime, tz)) <= nowMs;
	} catch {
		return false;
	}
}

/**
 * Routines grouped for the rail: fixed bucket order, empty buckets dropped,
 * each row carrying done-today, current streak (computeRoutineStats over the
 * recent completion history the fetcher provides), and whether it's missed.
 */
export function bucketRoutines(input: {
	routines: RoutineRow[];
	completions: Array<Pick<CompletionRow, "routine_id" | "completed_date">>;
	todayIso: string;
	tz: string;
	nowMs: number;
}): RoutineBucket[] {
	const { routines, completions, todayIso, tz, nowMs } = input;
	const datesByRoutine = new Map<string, string[]>();
	for (const c of completions) {
		const dates = datesByRoutine.get(c.routine_id);
		if (dates) dates.push(c.completed_date);
		else datesByRoutine.set(c.routine_id, [c.completed_date]);
	}

	const order: RoutineRow["time_of_day"][] = ["morning", "afternoon", "evening", "anytime"];
	return order
		.map((bucket) => ({
			bucket,
			rows: routines
				.filter((r) => r.time_of_day === bucket)
				.map((r) => {
					const dates = datesByRoutine.get(r.id) ?? [];
					const stats: RoutineStats = computeRoutineStats(dates, todayIso);
					return {
						id: r.id,
						name: r.name,
						done: stats.done_today,
						streak: stats.current_streak,
						trail: recentDaysGrid(dates, todayIso, 7).map((d) => d.done),
						specificTime: r.specific_time,
						reminderEnabled: r.reminder_enabled,
						missed: isRoutineMissed(r.specific_time, stats.done_today, todayIso, tz, nowMs),
					};
				}),
		}))
		.filter((b) => b.rows.length > 0);
}
