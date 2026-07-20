"use client";

import { useTransition } from "react";
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

	function toggle() {
		startTransition(() => toggleCompletionAction(routine.id, stats.done_today));
	}

	function remove() {
		if (!window.confirm(`Delete "${routine.name}"? Its completion history will be lost too.`)) {
			return;
		}
		startTransition(() => deleteRoutineAction(routine.id));
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
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
						aria-pressed={stats.done_today}
						aria-label={
							stats.done_today
								? `Mark "${routine.name}" not done today`
								: `Mark "${routine.name}" done today`
						}
						disabled={pending}
						onClick={toggle}
						className={`border px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest ${
							stats.done_today
								? "border-ink bg-ink text-bg"
								: "border-line text-ink-3 hover:border-line-strong hover:text-ink"
						}`}
					>
						{stats.done_today ? "Done" : "Mark done"}
					</button>
					<button
						type="button"
						aria-label={`Delete routine "${routine.name}"`}
						disabled={pending}
						onClick={remove}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
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
						className={`h-3 w-3 ${d.done ? "bg-ink" : "bg-line"} ${d.isToday ? "ring-1 ring-accent-slip" : ""}`}
					/>
				))}
			</div>
		</li>
	);
}
