"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { createPersonAction } from "./actions";

const RELATIONSHIP_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "family", label: "Family" },
	{ value: "church", label: "Church" },
	{ value: "friend", label: "Friend" },
	{ value: "team", label: "Team" },
	{ value: "vendor", label: "Vendor" },
	{ value: "other", label: "Other" },
];

export function PersonForm() {
	const form = useCollapsibleForm(createPersonAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New person"
			submitLabel="Add person"
			pendingLabel="Adding…"
		>
			<input
				name="name"
				required
				placeholder="Name"
				aria-label="Person name"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
			/>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Relationship</span>
					<select
						name="relationship_type"
						defaultValue=""
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						{RELATIONSHIP_TYPES.map((r) => (
							<option key={r.value} value={r.value}>
								{r.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Company</span>
					<input
						name="company"
						placeholder="Optional"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Email</span>
					<input
						name="email"
						type="email"
						placeholder="Optional"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Phone</span>
					<input
						name="phone"
						placeholder="Optional"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
