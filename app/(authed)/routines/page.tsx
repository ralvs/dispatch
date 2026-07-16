import { requireOwnerPage } from "@/lib/auth";
import { shiftDay, todayInTz } from "@/lib/dates";
import { computeRoutineStats, recentDaysGrid } from "@/lib/routine-stats";
import { listCompletions, listRoutines } from "@/lib/services/routines";
import { getAppTimezone } from "@/lib/services/settings";
import { RoutineForm } from "./routine-form";
import { RoutineRowItem } from "./routine-row";

export default async function RoutinesPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const sinceIso = shiftDay(todayIso, -35);

	const routines = await listRoutines(sb);
	const completionsByRoutine = await Promise.all(
		routines.map((r) => listCompletions(sb, r.id, sinceIso)),
	);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Routines</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">Daily habits</h1>
			</header>

			<section className="mt-6">
				<RoutineForm />
			</section>

			<section className="mt-6" aria-label="Routines">
				{routines.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						No routines yet. Add something you want to do daily.
					</p>
				) : (
					<ul className="mt-2">
						{routines.map((routine, i) => {
							const dates = completionsByRoutine[i].map((c) => c.completed_date);
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
