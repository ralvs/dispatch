"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { MEDICATION_KIND_LABELS, type MedicationKind } from "@/lib/schemas/health";
import { createMedicationAction } from "./actions";

const KINDS = Object.keys(MEDICATION_KIND_LABELS) as MedicationKind[];

export function MedicationForm() {
	const form = useCollapsibleForm(createMedicationAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New medication"
			submitLabel="Add medication"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Name</span>
					<input
						name="name"
						required
						aria-label="Medication name"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 font-serif text-base text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Kind</span>
					<select
						name="kind"
						defaultValue="prescription"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						{KINDS.map((k) => (
							<option key={k} value={k}>
								{MEDICATION_KIND_LABELS[k]}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Dosage</span>
					<input
						name="dosage"
						placeholder="10mg"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Frequency</span>
					<input
						name="frequency"
						placeholder="Once daily"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
