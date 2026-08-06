import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import type { BriefLine } from "@/lib/services/today";
import { CadenceBar } from "./cadence-bar";

/**
 * "In brief": one quiet line per domain at or past its cadence. It carries
 * no interaction of its own, so it stays compact — reference, not a feature.
 */
export function BriefSection({ lines }: { lines: BriefLine[] }) {
	return (
		<section aria-label="In brief">
			<h2 className="label">In brief</h2>
			{lines.length === 0 ? (
				<p className="py-8 font-serif italic text-ink-3">
					Nothing past cadence. Every domain is within its rhythm.
				</p>
			) : (
				<ul>
					{lines.map((line) => (
						<li key={line.key} className="hairline">
							<Link href={line.href} className="block py-3">
								<span className="flex items-center gap-4">
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
									{/* No per-domain page exists — this opens Settings, so "Review" is the honest word. */}
									<span
										className="shrink-0 text-meta text-accent-ink"
										title="Opens this domain in Settings"
									>
										Review →
									</span>
								</span>
								{line.nextAction && (
									<span className="mt-0.5 block truncate pl-[6.5rem] text-meta text-ink-2">
										{line.nextAction}
										{line.lastTouched && (
											<span className="text-ink-4"> · Last touched {line.lastTouched}</span>
										)}
									</span>
								)}
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
