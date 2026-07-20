"use client";

import { openCapturePalette } from "@/lib/capture/palette-bus";

// Chips capture, they don't navigate: tapping one used to throw you onto
// /notes or /quotes just to jot a line, losing Today in the process. Each now
// raises the palette seeded with its kind, which is also the hint the capture
// parser reads. Buttons, not links — they act in place.
const CHIPS = [
	{ label: "Journal", prefill: "Journal: " },
	{ label: "Quote", prefill: "Quote: " },
	{ label: "Note", prefill: "Note: " },
	{ label: "Task", prefill: "Task: " },
];

export function CaptureChips() {
	return (
		<section className="mt-10" aria-label="Capture">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Capture</h2>
			<div className="mt-2 flex flex-wrap items-baseline gap-2">
				{CHIPS.map((chip) => (
					<button
						key={chip.label}
						type="button"
						onClick={() => openCapturePalette({ prefill: chip.prefill })}
						className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
					>
						{chip.label}
					</button>
				))}
				<span className="ml-2 font-mono text-meta text-ink-4">— or ⌘J.</span>
			</div>
		</section>
	);
}
