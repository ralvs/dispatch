"use client";

import { useState, useTransition } from "react";
import { ColorDot } from "@/components/color-dot";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { Button, Card, Field, Input, ListRow, rowTitle, Textarea } from "@/components/ui";
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
 *
 * Rest name at 400 via `rowTitle()` (ADR-0044). Domain colour leads left
 * through ColorDot → `var(--domain-<slug>)`, never a hex.
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
				<form action={saveDetails}>
					<Card className="space-y-3" padding="compact">
						<Field label="Name">
							<Input name="name" required defaultValue={domain.name} />
						</Field>
						<Field label="Description">
							<Textarea
								name="description"
								rows={2}
								defaultValue={domain.description ?? ""}
								size="sm"
							/>
						</Field>
						<Field label="Fruit definition">
							<Textarea
								name="fruit_definition"
								rows={2}
								defaultValue={domain.fruit_definition ?? ""}
								size="sm"
							/>
						</Field>
						<Field label="Expected cadence">
							<Input name="expected_cadence" defaultValue={domain.expected_cadence ?? ""} />
						</Field>
						<Field
							label="Flag after (days)"
							description="How long this domain may go untouched before the nightly sweep marks it quiet and rings the bell."
						>
							<Input
								name="cadence_days"
								type="number"
								min={1}
								max={365}
								step={1}
								inputMode="numeric"
								placeholder="Leave blank for never"
								defaultValue={cadenceDays ?? ""}
							/>
						</Field>
						<ColorSwatchPicker name="color" defaultValue={domain.color} />
						<div className="flex justify-end gap-2 pt-1">
							<Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								isPending={pending}
								disabled={pending}
							>
								Save
							</Button>
						</div>
					</Card>
				</form>
			</li>
		);
	}

	const flagMeta =
		cadenceDays === null
			? "Flags after: never"
			: `Flags after: ${cadenceDays} day${cadenceDays === 1 ? "" : "s"}`;
	const shipped = domain.last_shipped_at
		? `Last shipped ${formatInstant(domain.last_shipped_at, tz)}`
		: "Last shipped never";

	return (
		<ListRow
			id={`domain-${domain.id}`}
			leading={<ColorDot color={domain.color} />}
			align="start"
			className={`scroll-mt-24 ${pending ? "opacity-50" : ""}`}
		>
			<span className={rowTitle()}>{domain.name}</span>
			{domain.description && <p className="mt-0.5 text-sm text-ink-3">{domain.description}</p>}
			{domain.fruit_definition && (
				<p className="mt-0.5 font-mono text-meta text-ink-4">Fruit: {domain.fruit_definition}</p>
			)}
			{domain.expected_cadence && (
				<p className="mt-0.5 font-mono text-meta text-ink-4">Cadence: {domain.expected_cadence}</p>
			)}
			<p className="mt-0.5 font-mono text-meta text-ink-4">
				{flagMeta} · {shipped}
			</p>
			<div className="mt-2 flex flex-wrap gap-2">
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					aria-label={`Edit ${domain.name}`}
					onClick={() => setEditing(true)}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
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
				>
					Mark shipped
				</Button>
				{domain.active ? (
					<Button
						type="button"
						variant="danger"
						size="sm"
						aria-label={`Archive ${domain.name}`}
						disabled={pending}
						onClick={() =>
							startTransition(async () => {
								await runAction(() => archiveDomainAction(domain.id), "Couldn't archive domain.");
							})
						}
					>
						Archive
					</Button>
				) : (
					<Button
						type="button"
						variant="tertiary"
						size="sm"
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
					>
						Reactivate
					</Button>
				)}
			</div>
		</ListRow>
	);
}
