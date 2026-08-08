import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { shiftDay, todayInTz } from "@/lib/dates";
import { computeRoutineStats, recentDaysGrid } from "@/lib/routine-stats";
import { listCompletionsForRoutines, listRoutines } from "@/lib/services/routines";
import { getAppTimezone } from "@/lib/services/settings";
import { RoutineForm } from "./routine-form";
import { RoutineRowItem } from "./routine-row";

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

	return (
		<div>
			<PageHeader
				title="Routines"
				measure={[
					{ count: routines.length, label: routines.length === 1 ? "routine" : "routines" },
				]}
			/>

			<section>
				<RoutineForm />
			</section>

			<section className="mt-6" aria-label="Routines">
				{routines.length === 0 ? (
					<EmptyState>No routines yet. Add something you want to do daily.</EmptyState>
				) : (
					<ul className="mt-2">
						{routines.map((routine) => {
							const dates = (completionsByRoutine[routine.id] ?? []).map((c) => c.completed_date);
							const stats = computeRoutineStats(dates, todayIso);
							const recentDays = recentDaysGrid(dates, todayIso, 30);
							return (
								<RoutineRowItem
									key={routine.id}
									routine={routine}
									stats={stats}
									recentDays={recentDays}
								/>
							);
						})}
					</ul>
				)}
			</section>
		</div>
	);
}
