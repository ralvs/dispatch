import type { Stat } from "@/components/ui";
import type { RoutineStats } from "@/lib/routine-stats";

/**
 * The band the shape plan §05 asked for on /routines: kept over 30 days, kept
 * over the last 7, and the current day streak. Every figure is derived from
 * the completion log the rows already read (lib/routine-stats.ts), so the band
 * and the rows cannot disagree.
 *
 * A rate needs a denominator, and the honest one is "routines × days", not
 * "days": with three routines and one ticked yesterday, 1/3 is the truth and
 * 100% would be a lie about the other two.
 *
 * §05 also listed "the 30-day grid, moved up from the rows". It stayed on the
 * rows: P8 made those 30 squares clickable (docs/adr/0054), so a page-level
 * copy would be a second grid of the same data, and only one of the two could
 * be tapped. The band carries the figures the rows cannot.
 *
 * No `attention` anywhere. A missed day is not an alarm — the one orange means
 * "this needs you", and a habit page that shouts every morning stops meaning
 * anything (ADR-0053, DESIGN.md).
 */
export function routineStats(stats: RoutineStats[]): Stat[] {
	const kept30 = stats.reduce((n, s) => n + s.completions_30d, 0);
	const kept7 = stats.reduce((n, s) => n + s.completions_7d, 0);
	const longestCurrent = stats.reduce((n, s) => Math.max(n, s.current_streak), 0);

	const pct = (kept: number, days: number) =>
		stats.length === 0 ? "—" : `${Math.round((kept / (stats.length * days)) * 100)}%`;

	return [
		{ value: pct(kept30, 30), label: "kept · 30d" },
		{ value: pct(kept7, 7), label: "kept · last 7" },
		{ value: longestCurrent, label: "day streak" },
	];
}
