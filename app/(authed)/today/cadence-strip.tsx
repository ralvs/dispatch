import Link from "next/link";
import type { CadenceLine } from "@/lib/services/briefing";

/**
 * The day's counts as one scannable row. buildCadenceLines has fed the widget
 * and chat context since Phase 5; ADR-0014 finally renders it on Today, where
 * it belongs. Nothing to say means nothing rendered.
 */
export function CadenceStrip({ lines }: { lines: CadenceLine[] }) {
	if (lines.length === 0) return null;

	return (
		<section className="mt-6" aria-label="Cadence">
			<ul className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
				{lines.map((line) => (
					<li key={line.key}>
						<Link href={line.href} className="block hover:opacity-80">
							<span
								className={`block font-serif text-[30px] leading-none tabular-nums ${
									line.slip ? "text-accent-slip" : "text-ink"
								}`}
							>
								{line.big}
							</span>
							<span className="mt-1.5 block font-mono text-eyebrow uppercase tracking-widest text-ink-3">
								{line.label}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
