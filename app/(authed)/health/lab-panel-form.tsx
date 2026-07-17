"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createLabPanelAction } from "./actions";

export function LabPanelForm() {
	const form = useCollapsibleForm(createLabPanelAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New lab panel"
			submitLabel="Add panel"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Drawn</span>
					<input
						type="date"
						name="drawn_date"
						required
						aria-label="Drawn date"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Panel name</span>
					<input
						name="panel_name"
						required
						placeholder="Basic metabolic panel"
						aria-label="Panel name"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Ordering provider</span>
					<input
						name="ordering_provider"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Facility</span>
					<input
						name="lab_facility"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
