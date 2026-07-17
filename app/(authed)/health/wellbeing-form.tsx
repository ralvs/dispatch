"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createWellbeingCheckInAction } from "./actions";

export function WellbeingForm() {
	const form = useCollapsibleForm(createWellbeingCheckInAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New check-in"
			submitLabel="Save check-in"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Mood (1-5)</span>
					<input
						type="number"
						name="mood"
						min={1}
						max={5}
						aria-label="Mood"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Energy (1-5)</span>
					<input
						type="number"
						name="energy"
						min={1}
						max={5}
						aria-label="Energy"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Sleep quality (1-5)</span>
					<input
						type="number"
						name="sleep_quality"
						min={1}
						max={5}
						aria-label="Sleep quality"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Pain (0-10)</span>
					<input
						type="number"
						name="pain"
						min={0}
						max={10}
						aria-label="Pain"
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
