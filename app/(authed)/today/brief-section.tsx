import Link from "next/link";
import type { BriefLine } from "@/lib/services/briefing";
import { CadenceBar } from "./cadence-bar";

/** "In brief": one row per domain at or past its cadence. Facts only. */
export function BriefSection({ lines }: { lines: BriefLine[] }) {
	return (
		<section aria-label="In brief">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">In brief</h2>
			{lines.length === 0 ? (
				<p className="py-8 font-serif italic text-ink-3">
					Nothing past cadence. Every domain is within its rhythm.
				</p>
			) : (
				<ul>
					{lines.map((line) => (
						<li key={line.key} className="border-b border-line">
							<Link href={line.href} className="block py-4">
								<div className="flex items-start justify-between gap-4">
									<span className="font-serif text-lg font-medium text-ink">{line.name}</span>
									<span className="text-right">
										<span
											className={`block font-serif text-[34px] leading-none tabular-nums ${
												line.slipping ? "text-accent-slip" : "text-ink"
											}`}
										>
											{line.daysSince}
										</span>
										<span className="text-[11px] text-ink-3">{line.unit}</span>
									</span>
								</div>
								<CadenceBar daysSince={line.daysSince} thresholdDays={line.thresholdDays} />
								<p className="mt-3">
									<span className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
										Next
									</span>
									<span className="ml-3 text-[13px] text-ink-2">{line.nextAction}</span>
								</p>
								<p className="mt-1 font-mono text-eyebrow uppercase tracking-widest text-accent">
									Open {line.name} →
								</p>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
