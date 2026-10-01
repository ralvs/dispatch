"use client";

import { useState, useTransition } from "react";
import { Button, Card, Field, Input, ListRow, rowTitle, Select } from "@/components/ui";
import { toastError } from "@/lib/client/toast";
import type { RoutineStats } from "@/lib/routine-stats";
import {
	type RoutineWithHistory,
	TIME_OF_DAY_LABELS,
	TIME_OF_DAY_ORDER,
	TimeOfDayBucketSchema,
} from "@/lib/schemas/routine";
import { isNavigationError, useRunIntent, useStoreWrite } from "@/lib/store";
import { deleteRoutineAction, toggleCompletionAction, updateRoutineAction } from "./actions";

const SAVE_ERROR = "Couldn't save routine.";

export function RoutineRowItem({
	routine,
	stats,
	recentDays,
}: {
	routine: RoutineWithHistory;
	stats: RoutineStats;
	recentDays: Array<{ date: string; done: boolean; isToday: boolean }>;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const run = useRunIntent("routine", { errorMessage: "Couldn't update routine." });
	const edit = useStoreWrite("routine");

	// The grid is the routine's row in the entity store (#29): today is just
	// the last square, so backfill and "Mark done" are the same intent and
	// cannot disagree about the same day (docs/adr/0054).
	const todayCell = recentDays.find((d) => d.isToday);
	const doneToday = todayCell ? todayCell.done : stats.done_today;
	const completedCount = recentDays.filter((d) => d.done).length;

	function toggleDay(date: string, currentlyDone: boolean) {
		run({ type: "toggle", id: routine.id, date, done: !currentlyDone }, () =>
			toggleCompletionAction(routine.id, currentlyDone, date),
		);
	}

	function toggle() {
		if (todayCell) toggleDay(todayCell.date, doneToday);
	}

	function saveDetails(formData: FormData) {
		const name = String(formData.get("name") ?? "").trim();
		const timeOfDay = TimeOfDayBucketSchema.safeParse(formData.get("time_of_day"));
		const patch = {
			...(name ? { name } : {}),
			...(timeOfDay.success ? { time_of_day: timeOfDay.data } : {}),
		};
		startTransition(async () => {
			try {
				const result = await edit({ type: "edit", id: routine.id, patch }, () =>
					updateRoutineAction(routine.id, formData),
				);
				if (result.ok) setEditing(false);
				else toastError(result.formError ?? SAVE_ERROR);
			} catch (error) {
				// A redirect() (an expired session) navigates on its own; it is not a failure.
				if (!isNavigationError(error)) toastError(SAVE_ERROR);
			}
		});
	}

	function remove() {
		if (!window.confirm(`Delete "${routine.name}"? Its completion history will be lost too.`)) {
			return;
		}
		run({ type: "delete", id: routine.id }, () => deleteRoutineAction(routine.id));
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
					const done = d.done;
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
