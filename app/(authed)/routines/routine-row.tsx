"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Button, Card, Field, Input, ListRow, rowTitle, Select } from "@/components/ui";
import { runAction } from "@/lib/client/toast";
import type { RoutineStats } from "@/lib/routine-stats";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/schemas/routine";
import type { RoutineRow } from "@/lib/services/routines";
import { deleteRoutineAction, toggleCompletionAction, updateRoutineAction } from "./actions";

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
	const [editing, setEditing] = useState(false);
	// One optimistic map over the whole grid: today is just the last square,
	// so backfill and "Mark done" share a single reducer rather than two that
	// could disagree about the same day (docs/adr/0054).
	const [overrides, setOverride] = useOptimistic(
		{} as Record<string, boolean>,
		(current, next: { date: string; done: boolean }) => ({ ...current, [next.date]: next.done }),
	);

	const todayCell = recentDays.find((d) => d.isToday);
	const doneOn = (date: string, stored: boolean) => overrides[date] ?? stored;
	const doneToday = todayCell ? doneOn(todayCell.date, todayCell.done) : stats.done_today;
	const completedCount = recentDays.filter((d) => doneOn(d.date, d.done)).length;

	function toggleDay(date: string, currentlyDone: boolean) {
		startTransition(async () => {
			setOverride({ date, done: !currentlyDone });
			await runAction(
				async () => toggleCompletionAction(routine.id, currentlyDone, date),
				"Couldn't update routine.",
			);
		});
	}

	function toggle() {
		if (todayCell) return toggleDay(todayCell.date, doneToday);
		// No grid (a zero-day window) — fall back to the server's own today.
		startTransition(async () => {
			await runAction(
				async () => toggleCompletionAction(routine.id, doneToday),
				"Couldn't update routine.",
			);
		});
	}

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => updateRoutineAction(routine.id, formData),
				"Couldn't save routine.",
			);
			if (ok) setEditing(false);
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

	if (editing) {
		return (
			<li className="hairline py-3">
				<form action={saveDetails}>
					<Card className="space-y-3" padding="compact">
						<Field label="Name">
							<Input name="name" required defaultValue={routine.name} />
						</Field>
						<Field label="Time of day">
							<Select name="time_of_day" defaultValue={routine.time_of_day}>
								{TIME_OF_DAY_ORDER.map((t) => (
									<option key={t} value={t}>
										{TIME_OF_DAY_LABELS[t]}
									</option>
								))}
							</Select>
						</Field>
						<div className="flex justify-end gap-2 pt-1">
							<Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								isPending={pending}
								disabled={pending}
							>
								Save
							</Button>
						</div>
					</Card>
				</form>
			</li>
		);
	}

	return (
		<ListRow
			align="start"
			trailing={
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
						variant="tertiary"
						size="sm"
						aria-label={`Edit routine "${routine.name}"`}
						onClick={() => setEditing(true)}
					>
						Edit
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
			}
		>
			<p className={rowTitle()}>{routine.name}</p>
			<p className="mt-0.5 font-mono text-meta text-ink-4">
				{TIME_OF_DAY_LABELS[routine.time_of_day]} · streak {stats.current_streak} · best{" "}
				{stats.longest_streak} · {stats.completions_7d}/7d
			</p>
			{/* The 30 squares are buttons, not decoration (docs/adr/0054). The
				window they draw IS the window the server accepts, so nothing
				on screen is un-tickable and nothing tickable is off screen. */}
			<fieldset className="mt-2 flex gap-0.5">
				<legend className="sr-only">
					{`${completedCount} of last ${recentDays.length} days completed`}
				</legend>
				{recentDays.map((d) => {
					const done = doneOn(d.date, d.done);
					return (
						<button
							key={d.date}
							type="button"
							title={`${d.date} — ${done ? "done" : "not done"}`}
							aria-label={`${done ? "Unmark" : "Mark"} ${routine.name} done on ${d.date}`}
							aria-pressed={done}
							disabled={pending}
							onClick={() => toggleDay(d.date, done)}
							// Filled square vs. outlined square carries done/not-done
							// without relying on color alone.
							className={`h-3 w-3 transition-colors disabled:pointer-events-none ${
								done ? "bg-ink" : "border border-line bg-transparent hover:border-ink-3"
							} ${d.isToday ? "ring-1 ring-accent-slip" : ""}`}
						/>
					);
				})}
			</fieldset>
		</ListRow>
	);
}
