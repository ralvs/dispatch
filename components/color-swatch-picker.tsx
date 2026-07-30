"use client";

import { COLOR_PALETTE } from "@/lib/schemas/color";

/**
 * Radio group over the curated palette, plus a "None" option. Same
 * sr-only-radio + `peer` idiom as PriorityPicker (task-fields.tsx) — the
 * checked swatch gets a visible ring instead of the priority's underline,
 * since color itself is already the answer being shown.
 */
export function ColorSwatchPicker({
	name,
	defaultValue,
}: {
	name: string;
	defaultValue?: string | null;
}) {
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
						defaultChecked={!defaultValue}
						className="peer sr-only"
					/>
					<span className="flex size-7 items-center justify-center rounded-full border border-line font-mono text-meta text-ink-4 transition-colors hover:border-line-strong peer-checked:border-ink peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
						×
					</span>
				</label>
				{COLOR_PALETTE.map((color) => (
					<label
						key={color}
						className="relative flex size-11 cursor-pointer items-center justify-center"
						title={color}
					>
						<input
							type="radio"
							name={name}
							value={color}
							aria-label={`Color ${color}`}
							defaultChecked={defaultValue === color}
							className="peer sr-only"
						/>
						<span
							aria-hidden="true"
							style={{ backgroundColor: color }}
							className="block size-7 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-surface transition-shadow peer-checked:ring-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
						/>
					</label>
				))}
			</div>
		</fieldset>
	);
}
