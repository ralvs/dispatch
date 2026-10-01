"use client";

import { EmptyState, PageHeader, StatBand } from "@/components/ui";
import { BACKFILL_DAYS, computeRoutineStats, recentDaysGrid } from "@/lib/routine-stats";
import type { RoutineWithHistory } from "@/lib/schemas/routine";
import { useClock, useView, viewKey } from "@/lib/store";
import { RoutineCreateButton } from "./routine-form";
import { RoutineRowItem } from "./routine-row";
import { routineStats } from "./routine-stats-band";

const NO_ROUTINES: RoutineWithHistory[] = [];

/**
 * /routines from the entity store (#29). The header's count, the band and the
 * rows all derive from the same rows, so a tick, a rename or a delete moves
 * every figure on the page at once — and Today's card, which reads the same
 * view.
 */
export function RoutineList() {
	const routines = useView(viewKey.routines()) ?? NO_ROUTINES;
	const { todayIso } = useClock();

	// Computed once here and handed to both the band and the rows — two
	// passes over the same completion log could drift.
	const perRoutine = routines.map((routine) => ({
		routine,
		stats: computeRoutineStats(routine.completions, todayIso),
		recentDays: recentDaysGrid(routine.completions, todayIso, BACKFILL_DAYS),
	}));

	return (
		<div>
			<PageHeader
				title="Routines"
				measure={[
					{ count: routines.length, label: routines.length === 1 ? "routine" : "routines" },
				]}
				action={<RoutineCreateButton />}
			/>

			{routines.length > 0 && <StatBand stats={routineStats(perRoutine.map((r) => r.stats))} />}

			{routines.length === 0 ? (
				<EmptyState>No routines yet. Add something you want to do daily.</EmptyState>
			) : (
				// Single ungrouped list — header measure is the count.
				<ul>
					{perRoutine.map(({ routine, stats, recentDays }) => (
						<RoutineRowItem
							key={routine.id}
							routine={routine}
							stats={stats}
							recentDays={recentDays}
						/>
					))}
				</ul>
			)}
		</div>
	);
}
