"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
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
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Name</span>
				<input
					name="name"
					required
					aria-label="Routine name"
					placeholder="Stretch, read, drink water…"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 font-serif text-base text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Time of day</span>
				<select
					name="time_of_day"
					defaultValue="anytime"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
				>
					{TIME_OF_DAY_ORDER.map((t) => (
						<option key={t} value={t}>
							{TIME_OF_DAY_LABELS[t]}
						</option>
					))}
				</select>
			</label>
		</CollapsibleForm>
	);
}
