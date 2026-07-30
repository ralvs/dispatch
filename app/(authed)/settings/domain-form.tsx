"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { createDomainAction } from "./actions";

export function DomainForm() {
	const form = useCollapsibleForm(createDomainAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New domain"
			submitLabel="Add domain"
			pendingLabel="Adding…"
		>
			<input
				name="name"
				required
				placeholder="Domain name"
				aria-label="Domain name"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink placeholder:text-ink-4"
			/>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Description</span>
				<textarea
					name="description"
					rows={2}
					placeholder="Optional"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Fruit definition</span>
				<textarea
					name="fruit_definition"
					rows={2}
					placeholder="What does healthy look like here?"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Expected cadence</span>
				<input
					name="expected_cadence"
					placeholder="Optional"
					className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<ColorSwatchPicker name="color" />
		</CollapsibleForm>
	);
}
