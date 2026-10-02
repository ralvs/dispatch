"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select } from "@/components/ui";
import { createRoutineAction } from "@/lib/actions/routines";
import { nowUtc } from "@/lib/dates";
import {
	type RoutineWithHistory,
	TIME_OF_DAY_LABELS,
	TIME_OF_DAY_ORDER,
	TimeOfDayBucketSchema,
} from "@/lib/schemas/routine";
import { useStoreWrite } from "@/lib/store";

/**
 * The row the list shows while the server writes it. A rejected field drops
 * it again; a confirmed one swaps it for the server's row (#29).
 */
function optimisticRoutine(formData: FormData): RoutineWithHistory {
	const at = nowUtc();
	const timeOfDay = TimeOfDayBucketSchema.safeParse(formData.get("time_of_day"));
	return {
		id: crypto.randomUUID(),
		name: String(formData.get("name") ?? "").trim() || "Untitled",
		description: null,
		position: 0,
		active: true,
		time_of_day: timeOfDay.success ? timeOfDay.data : "anytime",
		specific_time: null,
		reminder_enabled: false,
		last_reminder_sent_date: null,
		goal_days: null,
		archived_at: null,
		created_at: at,
		updated_at: at,
		completions: [],
	};
}

/** Create a routine — dialog behind the header's `+` (Gate B / B1). */
export function RoutineCreateButton() {
	const write = useStoreWrite("routine");

	return (
		<CreateDialogButton
			label="New routine"
			title="New routine"
			submitLabel="Add routine"
			errorMessage="Couldn't add routine. Try again."
			action={(formData) =>
				write({ type: "create", routine: optimisticRoutine(formData) }, () =>
					createRoutineAction(formData),
				)
			}
		>
			<Field label="Name" name="name">
				<Input
					name="name"
					required
					aria-label="Routine name"
					placeholder="Stretch, read, drink water…"
					className="text-base"
					data-autofocus
				/>
			</Field>
			<Field label="Time of day" name="time_of_day">
				<Select name="time_of_day" defaultValue="anytime">
					{TIME_OF_DAY_ORDER.map((t) => (
						<option key={t} value={t}>
							{TIME_OF_DAY_LABELS[t]}
						</option>
					))}
				</Select>
			</Field>
		</CreateDialogButton>
	);
}
