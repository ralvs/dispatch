import { EmptyState, PageHeader, StatBand } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { shiftDay, todayInTz } from "@/lib/dates";
import { BACKFILL_DAYS, computeRoutineStats, recentDaysGrid } from "@/lib/routine-stats";
import { listCompletionsForRoutines, listRoutines } from "@/lib/services/routines";
import { getAppTimezone } from "@/lib/services/settings";
import { RoutineCreateButton } from "./routine-form";
import { RoutineRowItem } from "./routine-row";
import { routineStats } from "./routine-stats-band";

export default async function RoutinesPage() {
	const { sb } = await requireOwnerPage();
	// Completions depend on the routine ids, so that hop stays sequential; the
	// timezone read does not, and used to sit in front of both.
	const [tz, routines] = await Promise.all([getAppTimezone(sb), listRoutines(sb)]);
	const todayIso = todayInTz(tz);
	const sinceIso = shiftDay(todayIso, -35);

	const completionsByRoutine = await listCompletionsForRoutines(
		sb,
		routines.map((r) => r.id),
		sinceIso,
	);

	// Computed once here and handed to both the band and the rows — two
	// passes over the same completion log could drift.
	const perRoutine = routines.map((routine) => {
		const dates = (completionsByRoutine[routine.id] ?? []).map((c) => c.completed_date);
		return {
			routine,
			stats: computeRoutineStats(dates, todayIso),
			recentDays: recentDaysGrid(dates, todayIso, BACKFILL_DAYS),
		};
	});

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
