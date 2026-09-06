"use client";

import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/icon";

/**
 * Sentinel for "this column is null" — distinct from "" which means no narrow
 * at all. Since ADR-0027 an unfiled task carries `domain_id: null` rather than
 * a pseudo-domain row, so without this the unfiled queue is unreachable from
 * the filters. `project_id` and `notes.domain_id` get the same treatment.
 */
export const UNFILED = "none";

export type ScopeOption = { id: string; name: string };

/**
 * The rarely-touched narrow: a filter that reads as text until you reach for
 * it — no label, no box, native caret suppressed. A chosen value colours
 * itself, which is the only state worth seeing at rest.
 *
 * Shipped for /tasks' project and domain filters and promoted here when
 * /notes gained a domain of its own (shape plan §05). Nothing about the
 * treatment is task-specific; the caller supplies every word.
 */
export function ScopeSelect({
	value,
	onChange,
	label,
	allLabel,
	unfiledLabel,
	options,
}: {
	value: string;
	onChange: (value: string) => void;
	label: string;
	allLabel: string;
	/** Omit on a SETTER: without it there is no null sentinel and "" is simply
	 *  "no value", which is what a picker means. Filters pass it. */
	unfiledLabel?: string;
	options: ScopeOption[];
}) {
	// A native select is always as wide as its longest option, which leaves a
	// dead gap before the caret. The visible text is a span sized to the chosen
	// value; the select itself is a transparent overlay that still owns the
	// interaction, the keyboard, and the accessible name.
	const current =
		value === ""
			? allLabel
			: value === UNFILED
				? (unfiledLabel ?? allLabel)
				: (options.find((o) => o.id === value)?.name ?? allLabel);

	return (
		<span
			className={`group relative inline-flex items-center gap-1 font-mono text-meta transition-colors ${
				value ? "text-accent-ink" : "text-ink-4"
			} has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent hover:text-ink`}
		>
			<span aria-hidden>{current}</span>
			<span aria-hidden className="inline-flex">
				<Icon icon={ChevronDown} size="sm" />
			</span>
			<select
				value={value}
				onChange={(event) => onChange(event.target.value)}
				aria-label={label}
				className="absolute inset-0 cursor-pointer opacity-0"
			>
				<option value="">{allLabel}</option>
				{unfiledLabel !== undefined && <option value={UNFILED}>{unfiledLabel}</option>}
				{options.map((o) => (
					<option key={o.id} value={o.id}>
						{o.name}
					</option>
				))}
			</select>
		</span>
	);
}
