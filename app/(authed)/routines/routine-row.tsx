"use client";

import { useOptimistic, useTransition } from "react";
import { Button } from "@/components/ui";
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
	const completedCount = recentDays.reduce(
		(n, d) => n + (d.isToday ? (doneToday ? 1 : 0) : d.done ? 1 : 0),
		0,
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
				<div className="min-w-0">
					<p className="truncate type-title text-base text-ink">{routine.name}</p>
					<p className="mt-0.5 font-mono text-meta text-ink-4">
						{TIME_OF_DAY_LABELS[routine.time_of_day]} · streak {stats.current_streak} · best{" "}
						{stats.longest_streak} · {stats.completions_7d}/7d
					</p>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						type="button"
						variant={doneToday ? "primary" : "tertiary"}
						size="sm"
						aria-pressed={doneToday}
						aria-label={
							doneToday
								? `Mark "${routine.name}" not done today`
								: `Mark "${routine.name}" done today`
						}
						onClick={toggle}
					>
						{doneToday ? "Done" : "Mark done"}
					</Button>
					<Button
						type="button"
						variant="danger"
						size="sm"
						aria-label={`Delete routine "${routine.name}"`}
						disabled={pending}
						onClick={remove}
					>
						Delete
					</Button>
				</div>
			</div>
			<div
				className="mt-2 flex gap-0.5"
				role="img"
				aria-label={`${completedCount} of last ${recentDays.length} days completed`}
			>
				{recentDays.map((d) => {
					const done = d.isToday ? doneToday : d.done;
					return (
						<span
							key={d.date}
							title={d.date}
							// Filled square vs. outlined square carries done/not-done
							// without relying on color alone.
							className={`h-3 w-3 ${
								done ? "bg-ink" : "border border-line bg-transparent"
							} ${d.isToday ? "ring-1 ring-accent-slip" : ""}`}
						/>
					);
				})}
			</div>
		</li>
	);
}
