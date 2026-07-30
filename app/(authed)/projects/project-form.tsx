"use client";

import { CollapsibleForm, useCollapsibleForm } from "@/components/collapsible-form";
import type { DomainRow } from "@/lib/services/domains";
import { createProjectAction } from "./actions";
import { ENGAGEMENT_TYPES, KINDS, PROJECT_TYPES } from "./constants";

export function ProjectForm({ domains }: { domains: DomainRow[] }) {
	const form = useCollapsibleForm(createProjectAction);

	return (
		<CollapsibleForm
			form={form}
			triggerLabel="+ New project"
			submitLabel="Add project"
			pendingLabel="Adding…"
		>
			<input
				name="name"
				required
				placeholder="Project name"
				aria-label="Project name"
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
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Domain</span>
					<select
						name="domain_id"
						defaultValue=""
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						<option value="">Unassigned</option>
						{domains.map((d) => (
							<option key={d.id} value={d.id}>
								{d.name}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Type</span>
					<select
						name="type"
						defaultValue=""
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						{PROJECT_TYPES.map((t) => (
							<option key={t.value} value={t.value}>
								{t.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Kind</span>
					<select
						name="kind"
						defaultValue="project"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						{KINDS.map((k) => (
							<option key={k.value} value={k.value}>
								{k.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Engagement</span>
					<select
						name="engagement_type"
						defaultValue="project"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					>
						{ENGAGEMENT_TYPES.map((e) => (
							<option key={e.value} value={e.value}>
								{e.label}
							</option>
						))}
					</select>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Quoted hours</span>
					<input
						name="quoted_hours"
						type="number"
						min="0"
						step="0.5"
						placeholder="Optional"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Start date</span>
					<input
						name="start_date"
						type="date"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Target date</span>
					<input
						name="target_date"
						type="date"
						className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
					/>
				</label>
			</div>
		</CollapsibleForm>
	);
}
