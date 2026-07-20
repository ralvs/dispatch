import Link from "next/link";

const CHIPS = [
	{ label: "Journal", href: "/journal" },
	{ label: "Quote", href: "/quotes" },
	{ label: "Note", href: "/notes" },
	{ label: "Task", href: "/tasks" },
];

export function CaptureChips() {
	return (
		<section className="mt-10" aria-label="Capture">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Capture</h2>
			<div className="mt-2 flex flex-wrap items-baseline gap-2">
				{CHIPS.map((chip) => (
					<Link
						key={chip.href}
						href={chip.href}
						className="rounded-full border border-line px-3 py-1.5 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
					>
						{chip.label}
					</Link>
				))}
				<span className="ml-2 font-mono text-meta text-ink-4">— or hold the mic.</span>
			</div>
		</section>
	);
}
