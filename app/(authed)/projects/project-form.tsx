"use client";

import { useRef, useState, useTransition } from "react";
import type { DomainRow } from "@/lib/services/domains";
import { createProjectAction } from "./actions";

const PROJECT_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "internal", label: "Internal" },
	{ value: "content", label: "Content" },
];

const KINDS = [
	{ value: "project", label: "Project" },
	{ value: "area", label: "Area" },
];

const ENGAGEMENT_TYPES = [
	{ value: "project", label: "Project" },
	{ value: "retainer", label: "Retainer" },
];

export function ProjectForm({ domains }: { domains: DomainRow[] }) {
	const formRef = useRef<HTMLFormElement>(null);
	const [open, setOpen] = useState(false);
	const [pending, startTransition] = useTransition();

	function submit(formData: FormData) {
		startTransition(async () => {
			await createProjectAction(formData);
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
				+ New project
			</button>
		);
	}

	return (
		<form
			ref={formRef}
			action={submit}
			className="space-y-3 border border-line-strong bg-surface p-4"
		>
			<input
				name="name"
				required
				placeholder="Project name"
				aria-label="Project name"
				className="w-full border-b border-line bg-transparent pb-2 font-serif text-lg text-ink outline-none placeholder:text-ink-4"
			/>
			<label className="block">
				<span className="font-mono text-eyebrow uppercase text-ink-3">Description</span>
				<textarea
					name="description"
					rows={2}
					placeholder="Optional"
					className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
				/>
			</label>
			<div className="grid grid-cols-2 gap-3">
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Domain</span>
					<select
						name="domain_id"
						defaultValue=""
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
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
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
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
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
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
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
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
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Start date</span>
					<input
						name="start_date"
						type="date"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
				<label className="block">
					<span className="font-mono text-eyebrow uppercase text-ink-3">Target date</span>
					<input
						name="target_date"
						type="date"
						className="mt-1 w-full border border-line bg-bg px-2 py-1.5 text-sm text-ink"
					/>
				</label>
			</div>
			<div className="flex gap-2 pt-1">
				<button
					type="submit"
					disabled={pending}
					className="bg-ink px-4 py-2 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
				>
					{pending ? "Adding…" : "Add project"}
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
