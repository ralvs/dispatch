"use client";

import { useOptimistic, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import type { RoutineStats } from "@/lib/routine-stats";
import { TIME_OF_DAY_LABELS } from "@/lib/schemas/routine";
import type { RoutineRow } from "@/lib/services/routines";
import { deleteRoutineAction, toggleCompletionAction } from "./actions";

export function RoutineRowItem({
	routine,
	stats,
	recentDays,
}: {
	routine: RoutineRow;
	stats: RoutineStats;
	recentDays: Array<{ date: string; done: boolean; isToday: boolean }>;
}) {
	const [pending, startTransition] = useTransition();
	const [doneToday, setDoneToday] = useOptimistic(
		stats.done_today,
		(_current, next: boolean) => next,
	);

	function toggle() {
		const currentlyDone = doneToday;
		startTransition(async () => {
			setDoneToday(!currentlyDone);
			await runAction(
				async () => toggleCompletionAction(routine.id, currentlyDone),
				"Couldn't update routine.",
			);
		});
	}

	function remove() {
		if (!window.confirm(`Delete "${routine.name}"? Its completion history will be lost too.`)) {
			return;
		}
		startTransition(async () => {
			await runAction(async () => deleteRoutineAction(routine.id), "Couldn't update routine.");
		});
	}

	return (
		<li className="hairline py-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="font-serif text-base text-ink">{routine.name}</p>
					<p className="mt-0.5 font-mono text-meta text-ink-4">
						{TIME_OF_DAY_LABELS[routine.time_of_day]} · streak {stats.current_streak} · best{" "}
						{stats.longest_streak} · {stats.completions_7d}/7d
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					<button
						type="button"
						aria-pressed={doneToday}
						aria-label={
							doneToday
								? `Mark "${routine.name}" not done today`
								: `Mark "${routine.name}" done today`
						}
						onClick={toggle}
						className={`border px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest ${
							doneToday
								? "border-ink bg-ink text-bg"
								: "border-line text-ink-3 hover:border-line-strong hover:text-ink"
						}`}
					>
						{doneToday ? "Done" : "Mark done"}
					</button>
					<button
						type="button"
						aria-label={`Delete routine "${routine.name}"`}
						disabled={pending}
						onClick={remove}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip disabled:opacity-50"
					>
						Delete
					</button>
				</div>
			</div>
			<div className="mt-2 flex gap-0.5" role="img" aria-label={`${routine.name} last 30 days`}>
				{recentDays.map((d) => (
					<span
						key={d.date}
						title={d.date}
						className={`h-3 w-3 ${
							d.isToday ? (doneToday ? "bg-ink" : "bg-line") : d.done ? "bg-ink" : "bg-line"
						} ${d.isToday ? "ring-1 ring-accent-slip" : ""}`}
					/>
				))}
			</div>
		</li>
	);
}
