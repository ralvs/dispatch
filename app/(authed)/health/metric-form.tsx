"use client";

import { useRef, useState, useTransition } from "react";
import { COMMON_METRICS } from "@/lib/schemas/health";
import { createMetricAction } from "./actions";

export function MetricForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createMetricAction(formData);
			formRef.current?.reset();
			setOpen(false);
		});
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="w-full border border-line px-3 py-2.5 text-left font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
			>
				+ New reading
			</button>
		);
	}

	return (
		<form
			ref={formRef}
			action={submit}
			className="space-y-3 border border-line-strong bg-surface p-4"
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
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Saving…" : "Save reading"}
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="px-3 py-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}
