"use client";

import { CreateDialogButton } from "@/components/create-dialog";
import { Field, Input, Textarea } from "@/components/ui";
import { nowUtc } from "@/lib/dates";
import type { DomainItem } from "@/lib/schemas/domain";
import { useStoreWrite } from "@/lib/store";
import { createDomainAction } from "./actions";
import { ColorSwatchPicker } from "./color-swatch-picker";

/**
 * The domain the list shows while the server writes it. It has no touch yet;
 * the server's item, with its touch, replaces it (#30).
 */
function optimisticDomain(formData: FormData): DomainItem {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		description: text("description"),
		fruit_definition: text("fruit_definition"),
		failure_patterns: [],
		expected_cadence: text("expected_cadence"),
		active: true,
		last_shipped_at: null,
		color: text("color"),
		created_at: at,
		updated_at: at,
		cadenceDays: null,
		touch: null,
	};
}

/**
 * Create a domain — dialog behind the header's `+` (ADR-0044).
 * Standing CollapsibleForm above the list is gone with the move out of settings.
 */
export function DomainCreateButton() {
	const write = useStoreWrite("domain");

	return (
		<CreateDialogButton
			label="New domain"
			title="New domain"
			submitLabel="Add domain"
			errorMessage="Couldn't create domain. Try again."
			action={(formData) =>
				write({ type: "create", row: optimisticDomain(formData) }, () =>
					createDomainAction(formData),
				)
			}
			size="lg"
		>
			<Field name="name">
				<Input
					name="name"
					required
					placeholder="Domain name"
					aria-label="Domain name"
					size="lg"
					data-autofocus
				/>
			</Field>
			<Field label="Description" name="description">
				<Textarea name="description" rows={2} placeholder="Optional" size="sm" />
			</Field>
			<Field label="Fruit definition" name="fruit_definition">
				<Textarea
					name="fruit_definition"
					rows={2}
					placeholder="What does healthy look like here?"
					size="sm"
				/>
			</Field>
			<Field label="Expected cadence" name="expected_cadence">
				<Input name="expected_cadence" placeholder="Optional" />
			</Field>
			<ColorSwatchPicker name="color" />
		</CreateDialogButton>
	);
}
