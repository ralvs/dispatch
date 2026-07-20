"use client";

import { useState, useTransition } from "react";
import { formatInstant } from "@/lib/dates";
import type { DomainRow as DomainRowType } from "@/lib/services/domains";
import {
	archiveDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "./actions";

export function DomainRowItem({ domain, tz }: { domain: DomainRowType; tz: string }) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			await updateDomainAction(domain.id, formData);
			setEditing(false);
		});
	}

	if (editing) {
		return (
			<li className="hairline py-3">
				<form
					action={saveDetails}
					className="space-y-2 rounded-xl border border-line-strong bg-surface p-3"
				>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Name</span>
						<input
							name="name"
							required
							defaultValue={domain.name}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Description</span>
						<textarea
							name="description"
							rows={2}
							defaultValue={domain.description ?? ""}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Fruit definition</span>
						<textarea
							name="fruit_definition"
							rows={2}
							defaultValue={domain.fruit_definition ?? ""}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Expected cadence</span>
						<input
							name="expected_cadence"
							defaultValue={domain.expected_cadence ?? ""}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
						/>
					</label>
					<div className="flex gap-2 pt-1">
						<button
							type="submit"
							disabled={pending}
							className="rounded-md bg-ink px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-bg disabled:opacity-50"
						>
							Save
						</button>
						<button
							type="button"
							onClick={() => setEditing(false)}
							className="px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
						>
							Cancel
						</button>
					</div>
				</form>
			</li>
		);
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<div className="flex items-baseline justify-between gap-3">
				<span className="font-serif text-base text-ink">{domain.name}</span>
				{domain.is_system && (
					<span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 font-mono text-meta uppercase tracking-widest text-ink-3">
						System
					</span>
				)}
			</div>
			{domain.description && <p className="mt-0.5 text-sm text-ink-3">{domain.description}</p>}
			{domain.fruit_definition && (
				<p className="mt-0.5 text-meta text-ink-4">Fruit: {domain.fruit_definition}</p>
			)}
			{domain.expected_cadence && (
				<p className="mt-0.5 text-meta text-ink-4">Cadence: {domain.expected_cadence}</p>
			)}
			<p className="mt-0.5 font-mono text-meta text-ink-4">
				Last shipped: {domain.last_shipped_at ? formatInstant(domain.last_shipped_at, tz) : "never"}
			</p>

			{!domain.is_system && (
				<div className="mt-2 flex flex-wrap gap-2">
					<button
						type="button"
						aria-label={`Edit ${domain.name}`}
						onClick={() => setEditing(true)}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Edit
					</button>
					<button
						type="button"
						aria-label={`Mark ${domain.name} shipped`}
						disabled={pending}
						onClick={() => startTransition(() => markDomainShippedAction(domain.id))}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Mark shipped
					</button>
					{domain.active ? (
						<button
							type="button"
							aria-label={`Archive ${domain.name}`}
							disabled={pending}
							onClick={() => startTransition(() => archiveDomainAction(domain.id))}
							className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
						>
							Archive
						</button>
					) : (
						<button
							type="button"
							aria-label={`Reactivate ${domain.name}`}
							disabled={pending}
							onClick={() => startTransition(() => reactivateDomainAction(domain.id))}
							className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
						>
							Reactivate
						</button>
					)}
				</div>
			)}
		</li>
	);
}
