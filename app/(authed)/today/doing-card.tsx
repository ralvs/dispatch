import Link from "next/link";
import type { TaskRow } from "@/lib/services/tasks";
import { isTop3Today } from "@/lib/task-predicates";
import { TaskRowItem } from "../tasks/task-row";

const TOP3_SLOTS = 3;

export function DoingCard({
	tasks,
	todayIso,
	openCount,
	overdueCount,
}: {
	tasks: TaskRow[];
	todayIso: string;
	openCount: number;
	overdueCount: number;
}) {
	const top3Count = tasks.filter((t) => isTop3Today(t, todayIso)).length;
	const slotsOpen = TOP3_SLOTS - top3Count;

	return (
		<section className="mt-8" aria-label="Doing today">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Doing · {openCount} open
					{overdueCount > 0 && <span className="text-accent"> · {overdueCount} overdue</span>}
				</h2>
				<Link href="/tasks" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All tasks →
				</Link>
			</div>
			{tasks.length === 0 ? (
				<p className="py-8 text-center font-serif italic text-ink-3">
					A clear slate. Star tasks or set due dates to shape the day.
				</p>
			) : (
				<>
					<ul className="mt-2">
						{tasks.map((t) => (
							<TaskRowItem key={t.id} task={t} todayIso={todayIso} />
						))}
					</ul>
					{slotsOpen > 0 && (
						<p className="mt-2 font-mono text-meta text-ink-4">
							{slotsOpen} Top 3 slot{slotsOpen === 1 ? "" : "s"} open · tap ☆ on a row to pin
						</p>
					)}
				</>
			)}
		</section>
	);
}
