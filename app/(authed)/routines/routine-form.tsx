"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Select } from "@/components/ui";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/schemas/routine";
import { createRoutineAction } from "./actions";

/** Create a routine — dialog behind the header's `+` (Gate B / B1). */
export function RoutineCreateButton() {
	return (
		<CreateDialogButton
			label="New routine"
			title="New routine"
			submitLabel="Add routine"
			errorMessage="Couldn't add routine. Try again."
			action={createRoutineAction}
		>
			<Field label="Name">
				<Input
					name="name"
					required
					aria-label="Routine name"
					placeholder="Stretch, read, drink water…"
					className="text-base"
					data-autofocus
				/>
			</Field>
			<Field label="Time of day">
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
