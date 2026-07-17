"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { COMMON_METRICS } from "@/lib/schemas/health";
import { createMetricAction } from "./actions";

export function MetricForm() {
	const form = useCollapsibleForm(createMetricAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New reading"
			submitLabel="Save reading"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Metric</span>
					<input
						name="metric"
						required
						list="common-metrics"
						aria-label="Metric name"
						placeholder="weight, bp, hr_resting…"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
					<datalist id="common-metrics">
						{COMMON_METRICS.map((m) => (
							<option key={m} value={m} />
						))}
					</datalist>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Unit</span>
					<input
						name="unit"
						placeholder="kg, bpm…"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Value</span>
					<input
						type="number"
						step="any"
						name="value"
						aria-label="Value"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">
						Secondary (e.g. diastolic)
					</span>
					<input
						type="number"
						step="any"
						name="value_secondary"
						aria-label="Secondary value"
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
