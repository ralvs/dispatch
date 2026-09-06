import type { ReactNode } from "react";

/**
 * The stat band — docs/adr/0053, from the shape plan §05.
 *
 * A row of readings you cannot get by looking at the list: kept rate, day
 * streak, domains gone quiet, wants parked. Figures at 44px — one ramp step
 * under Today's 56px hero, one above the 36px page title — each under a mono
 * eyebrow label.
 *
 * It sits **below** PageHeader, never inside it. That is the whole decision:
 * ADR-0042's measure and ADR-0046's facts stay flat at 14px on the title line,
 * and the loud figures live in their own section. A header slot would invite
 * every page to fill one; a section is skippable, and most pages skip it.
 *
 * `attention` spends the one orange and means what it always means — this
 * needs you. A band of four orange figures is the misuse ADR-0053 forbids.
 */
export type Stat = {
	/** The figure. A string so "96%" and "3/8" are as native as a count. */
	value: number | string;
	/** The mono eyebrow beneath it. Two or three words, not a sentence. */
	label: string;
	attention?: boolean;
};

export function StatBand({
	stats,
	children,
	className = "",
}: {
	stats: Stat[];
	/** Anything the band carries beside its figures — /routines' 30-day grid. */
	children?: ReactNode;
	className?: string;
}) {
	if (stats.length === 0 && !children) return null;

	return (
		<section
			// mt-0 under the header: PageHeader already owns that gap (ADR-0046
			// Gate B). mb-8 is the list page's peer-section band.
			className={`mb-8 flex flex-wrap items-end gap-x-10 gap-y-5 ${className}`}
		>
			{stats.map((stat) => (
				<div key={stat.label} className="min-w-0">
					<div
						className={`text-t30 tabular-nums lg:text-t44 ${
							stat.attention ? "text-accent" : "text-ink"
						}`}
					>
						{stat.value}
					</div>
					<div className="mt-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						{stat.label}
					</div>
				</div>
			))}
			{children}
		</section>
	);
}
