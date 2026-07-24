import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import type { BriefLine } from "@/lib/services/briefing";
import { CadenceBar } from "./cadence-bar";

/**
 * "In brief": one quiet line per domain at or past its cadence. It carries
 * no interaction of its own, so it stays compact — reference, not a feature.
 */
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
						<li key={line.key} className="hairline">
							<Link href={line.href} className="flex items-center gap-4 py-3">
								<span className="flex w-20 shrink-0 items-center gap-1.5 truncate font-serif text-sm text-ink">
									<ColorDot color={line.color} />
									{line.name}
								</span>
								<span
									className={`shrink-0 whitespace-nowrap font-serif text-lg leading-none tabular-nums ${
										line.slipping ? "text-accent-slip" : "text-ink"
									}`}
								>
									{line.daysSince}
									<span className="ml-1 font-sans text-meta font-normal text-ink-3">
										{line.unit}
									</span>
								</span>
								<span className="min-w-[4rem] flex-1">
									<CadenceBar daysSince={line.daysSince} thresholdDays={line.thresholdDays} />
								</span>
								<span className="hidden min-w-0 flex-[1.4] truncate text-meta text-ink-2 lg:block">
									{line.nextAction}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
