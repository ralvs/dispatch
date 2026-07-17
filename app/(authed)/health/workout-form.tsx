"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createWorkoutAction } from "./actions";

export function WorkoutForm() {
	const form = useCollapsibleForm(createWorkoutAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New workout"
			submitLabel="Save workout"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Started</span>
					<input
						type="datetime-local"
						name="started_at"
						aria-label="Started at"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Activity</span>
					<input
						name="activity_type"
						placeholder="run, ride, swim…"
						aria-label="Activity type"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Duration (min)</span>
					<input
						type="number"
						step="any"
						name="duration_min"
						aria-label="Duration in minutes"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Distance (m)</span>
					<input
						type="number"
						step="any"
						name="distance_m"
						aria-label="Distance in meters"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Notes</span>
					<input
						name="notes"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
