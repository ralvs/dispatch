"use client";

import { useState, useTransition } from "react";
import { runAction } from "@/lib/client/toast";
import { formatInstant } from "@/lib/dates";
import type { DomainRow as DomainRowType } from "@/lib/services/domains";
import {
	archiveDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "./actions";

/**
 * `cadenceDays` is read out of failure_patterns by the page — the parser for
 * that shape is server-only, so it arrives already resolved.
 */
export function DomainRowItem({
	domain,
	tz,
	cadenceDays,
}: {
	domain: DomainRowType;
	tz: string;
	cadenceDays: number | null;
}) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			const ok = await runAction(
				() => updateDomainAction(domain.id, formData),
				"Couldn't save domain.",
			);
			if (ok) setEditing(false);
		});
	}

	if (editing) {
		return (
			<li id={`domain-${domain.id}`} className="hairline scroll-mt-24 py-3">
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
					<label className="block">
						<span className="font-mono text-eyebrow uppercase text-ink-3">Flag after (days)</span>
						<input
							name="cadence_days"
							type="number"
							min={1}
							max={365}
							step={1}
							inputMode="numeric"
							placeholder="Leave blank for never"
							defaultValue={cadenceDays ?? ""}
							className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-4"
						/>
						<span className="mt-1 block font-mono text-meta text-ink-4">
							Surfaces in "In brief" from 75% of this, slipping past it.
						</span>
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
		<li
			id={`domain-${domain.id}`}
			className={`hairline scroll-mt-24 py-3 ${pending ? "opacity-50" : ""}`}
		>
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
			{!domain.is_system && (
				<p className="mt-0.5 text-meta text-ink-4">
					{cadenceDays === null
						? "Flags after: never — no cadence rule"
						: `Flags after: ${cadenceDays} day${cadenceDays === 1 ? "" : "s"}`}
				</p>
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
						onClick={() =>
							startTransition(async () => {
								await runAction(
									() => markDomainShippedAction(domain.id),
									"Couldn't mark domain shipped.",
								);
							})
						}
						className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
					>
						Mark shipped
					</button>
					{domain.active ? (
						<button
							type="button"
							aria-label={`Archive ${domain.name}`}
							disabled={pending}
							onClick={() =>
								startTransition(async () => {
									await runAction(() => archiveDomainAction(domain.id), "Couldn't archive domain.");
								})
							}
							className="rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-accent-slip hover:border-accent-slip"
						>
							Archive
						</button>
					) : (
						<button
							type="button"
							aria-label={`Reactivate ${domain.name}`}
							disabled={pending}
							onClick={() =>
								startTransition(async () => {
									await runAction(
										() => reactivateDomainAction(domain.id),
										"Couldn't reactivate domain.",
									);
								})
							}
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
