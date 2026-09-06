import type { Stat } from "@/components/ui";
import {
	calendarDaysBetween,
	dateOfInstant,
	RECENT_DONE_DAYS,
	recentDoneSinceDate,
	shiftDay,
} from "@/lib/dates";
import type { TaskRow } from "@/lib/services/tasks";
import { isWant } from "@/lib/task-predicates";

/**
 * The band /tasks carries below its header (ADR-0053).
 *
 * Open / overdue / today / wants already live on the status strip, so repeating
 * them here taught the same counts twice. These three are the ones you cannot
 * get by looking at the list: recent throughput, the week's dated load, and
 * how long the oldest still-open task has been sitting.
 *
 * Scoped to the whole board, not the active filter — same contract as
 * /routines and /domains.
 */
export function taskStats(
	open: Pick<TaskRow, "someday" | "due_date" | "created_at">[],
	done: Pick<TaskRow, "completed_at">[],
	todayIso: string,
	tz: string,
): Stat[] {
	const sinceDate = recentDoneSinceDate(todayIso);
	const recentDone = done.filter(
		(t) => t.completed_at !== null && dateOfInstant(t.completed_at, tz) >= sinceDate,
	).length;

	const weekEnd = shiftDay(todayIso, 6);
	const active = open.filter((t) => !isWant(t));
	const due7 = active.filter(
		(t) => t.due_date !== null && t.due_date >= todayIso && t.due_date <= weekEnd,
	).length;

	let oldest: number | null = null;
	for (const t of active) {
		const age = calendarDaysBetween(dateOfInstant(t.created_at, tz), todayIso);
		if (oldest === null || age > oldest) oldest = age;
	}

	return [
		{ value: recentDone, label: `done · last ${RECENT_DONE_DAYS}d` },
		{ value: due7, label: "due · 7d" },
		{ value: oldest === null ? "—" : `${oldest}d`, label: "oldest open" },
	];
}
