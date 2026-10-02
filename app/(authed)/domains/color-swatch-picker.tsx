"use client";

import { X } from "lucide-react";
import { useFieldValue } from "@/components/ui/form-state";
import { Icon } from "@/components/ui/icon";
import { COLOR_SLUG_LABELS, COLOR_SLUGS, colorSlugVar } from "@/lib/schemas/color";

/**
 * Radio group over the nine palette slots, plus a "None" option. Same
 * sr-only-radio + `peer` idiom as PriorityPicker (task-fields.tsx) — the
 * checked swatch gets a visible ring instead of the priority's underline,
 * since colour itself is already the answer being shown.
 *
 * The value submitted is a slug, not a hex. "None" submits "" — a
 * present-but-blank nullable field, which lib/form-decode.ts turns into an
 * explicit null that clears the column.
 */
export function ColorSwatchPicker({
	name,
	defaultValue,
}: {
	name: string;
	defaultValue?: string | null;
}) {
	// A rejected submit hands back the pick, so the form's reset keeps it (#23).
	const echoed = useFieldValue(name);
	const checked = echoed ?? defaultValue;
	return (
		<fieldset className="block min-w-0">
			<legend className="font-mono text-eyebrow uppercase text-ink-3">Color</legend>
			<div className="mt-1 flex flex-wrap items-center">
				<label
					className="relative flex size-11 cursor-pointer items-center justify-center"
					title="None"
				>
					<input
						type="radio"
						name={name}
						value=""
						aria-label="None"
						defaultChecked={!checked}
						className="peer sr-only"
					/>
					<span className="flex size-7 items-center justify-center rounded-pill border border-line font-mono text-meta text-ink-4 transition-colors hover:border-line-strong peer-checked:border-ink peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
						<Icon icon={X} size="sm" />
					</span>
				</label>
				{COLOR_SLUGS.map((slug) => (
					<label
						key={slug}
						className="relative flex size-11 cursor-pointer items-center justify-center"
						title={COLOR_SLUG_LABELS[slug]}
					>
						<input
							type="radio"
							name={name}
							value={slug}
							aria-label={COLOR_SLUG_LABELS[slug]}
							defaultChecked={checked === slug}
							className="peer sr-only"
						/>
						<span
							aria-hidden="true"
							style={{ backgroundColor: colorSlugVar(slug) }}
							className="block size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface transition-shadow peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
						/>
					</label>
				))}
			</div>
		</fieldset>
	);
}
