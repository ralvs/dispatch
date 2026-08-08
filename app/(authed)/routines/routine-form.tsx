"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { Field, Input, Select } from "@/components/ui";
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_ORDER } from "@/lib/schemas/routine";
import { createRoutineAction } from "./actions";

export function RoutineForm() {
	const form = useCollapsibleForm(createRoutineAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New routine"
			submitLabel="Add routine"
			pendingLabel="Adding…"
		>
			<Field label="Name">
				<Input
					name="name"
					required
					aria-label="Routine name"
					placeholder="Stretch, read, drink water…"
					className="type-title text-base"
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
		</CollapsibleForm>
	);
}
