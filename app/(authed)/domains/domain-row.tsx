"use client";

import { useState, useTransition } from "react";
import { ColorDot } from "@/components/color-dot";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { Button, Card, Field, Input, ListRow, rowTitle, Textarea } from "@/components/ui";
import { toastError } from "@/lib/client/toast";
import { formatInstant, nowUtc } from "@/lib/dates";
import type { DomainItem } from "@/lib/schemas/domain";
import { isNavigationError, useProvisionalIds, useRunIntent, useStoreWrite } from "@/lib/store";
import {
	archiveDomainAction,
	markDomainShippedAction,
	reactivateDomainAction,
	updateDomainAction,
} from "./actions";

const SAVE_ERROR = "Couldn't save domain.";

/** What an edit asks for, so the row shows it while the server writes it. */
function domainPatch(formData: FormData): Partial<DomainItem> {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const name = text("name");
	const days = Number(String(formData.get("cadence_days") ?? "").trim());
	return {
		...(name ? { name } : {}),
		description: text("description"),
		fruit_definition: text("fruit_definition"),
		expected_cadence: text("expected_cadence"),
		...(formData.has("color") ? { color: text("color") } : {}),
		cadenceDays: Number.isInteger(days) && days > 0 ? days : null,
	};
}

/**
 * A row of the entity store's domain view (#30). `cadenceDays` and `touch`
 * ride on the row, resolved on the server — the parser for failure_patterns
 * and the last-touch fold are server-only and shared with the neglect cron, so
 * the row and the bell can never disagree (shape plan §05). Every write
 * answers with both, recomputed.
 *
 * Rest name at 400 via `rowTitle()` (ADR-0044). Domain colour leads left
 * through ColorDot → `var(--domain-<slug>)`, never a hex.
 */
export function DomainRowItem({ domain, tz }: { domain: DomainItem; tz: string }) {
	const [pending, startTransition] = useTransition();
	const [editing, setEditing] = useState(false);
	const run = useRunIntent("domain", { errorMessage: "Couldn't update domain." });
	const edit = useStoreWrite("domain");
	// Still being saved: its id is the client's, so nothing may act on it yet.
	const saving = useProvisionalIds("domain").has(domain.id);
	const { cadenceDays, touch } = domain;

	function saveDetails(formData: FormData) {
		startTransition(async () => {
			try {
				const result = await edit(
					{ type: "patch", id: domain.id, patch: domainPatch(formData) },
					() => updateDomainAction(domain.id, formData),
				);
				if (result.ok) setEditing(false);
				else toastError(result.formError ?? SAVE_ERROR);
			} catch (error) {
				// A redirect() (an expired session) navigates on its own; it is not a failure.
				if (!isNavigationError(error)) toastError(SAVE_ERROR);
			}
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

	// The two facts the plan asked every row to carry. "Days since last touch"
	// is the sweep's own measure, not last_shipped_at — shipping is one of its
	// four sources, not the whole of it.
	const lastTouch =
		touch === null
			? null
			: touch.daysSinceTouch === null
				? "Never touched"
				: touch.daysSinceTouch === 0
					? "Touched today"
					: `${touch.daysSinceTouch}d since last touch`;
	const openTasks =
		touch === null ? null : `${touch.openTasks} open task${touch.openTasks === 1 ? "" : "s"}`;

	return (
		<ListRow
			id={`domain-${domain.id}`}
			leading={<ColorDot color={domain.color} />}
			align="start"
			className="scroll-mt-24"
		>
			<span className={rowTitle()}>{domain.name}</span>
			{lastTouch !== null && (
				<p className="mt-0.5 flex items-center gap-1.5 font-mono text-meta text-ink-3">
					{touch?.quiet && (
						<span
							aria-hidden="true"
							className="inline-block size-1.5 shrink-0 rounded-full bg-accent"
						/>
					)}
					<span className={touch?.quiet ? "text-accent" : undefined}>
						{touch?.quiet ? `Quiet · ${lastTouch}` : lastTouch}
					</span>
					<span aria-hidden="true">·</span>
					<span>{openTasks}</span>
				</p>
			)}
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
					disabled={saving}
					onClick={() => setEditing(true)}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="tertiary"
					size="sm"
					aria-label={`Mark ${domain.name} shipped`}
					disabled={saving}
					onClick={() =>
						run({ type: "patch", id: domain.id, patch: { last_shipped_at: nowUtc() } }, () =>
							markDomainShippedAction(domain.id),
						)
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
						disabled={saving}
						onClick={() =>
							run({ type: "patch", id: domain.id, patch: { active: false, touch: null } }, () =>
								archiveDomainAction(domain.id),
							)
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
						disabled={saving}
						onClick={() =>
							run({ type: "patch", id: domain.id, patch: { active: true } }, () =>
								reactivateDomainAction(domain.id),
							)
						}
					>
						Reactivate
					</Button>
				)}
			</div>
		</ListRow>
	);
}
