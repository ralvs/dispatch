"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { VisitTypeSchema } from "@/lib/schemas/health";
import { createVisitAction } from "./actions";

const VISIT_TYPES = VisitTypeSchema.options;

export function VisitForm() {
	const form = useCollapsibleForm(createVisitAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New visit"
			submitLabel="Add visit"
			pendingLabel="Saving…"
		>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Date</span>
					<input
						type="date"
						name="visit_date"
						required
						aria-label="Visit date"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Type</span>
					<select
						name="visit_type"
						defaultValue=""
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					>
						<option value="">Unspecified</option>
						{VISIT_TYPES.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Provider</span>
					<input
						name="provider_name"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Specialty</span>
					<input
						name="provider_specialty"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="col-span-2 block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Reason</span>
					<input
						name="reason"
						placeholder="Optional"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
