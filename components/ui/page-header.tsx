import type { ReactNode } from "react";

/**
 * The page header — revision A, option D, chosen at the Pass 0 gate
 * (.impeccable/mocks/chrome-header-lab.html, docs/adr/0042).
 *
 * Slots, in one line where there is room: **title · facts · measure · action**,
 * with an optional subtitle beneath.
 *
 *   Projects                              14 open   3 paused
 *   Notes                    128 notes  3 need review   [+ New note]
 *   Dispatch rewrite         Internal  Active  3/8 tasks
 *
 * Three things it is not, each of them a deliberate deletion:
 *
 *  - **No eyebrow above the title.** The mono eyebrow is alive everywhere it is
 *    a system label — the day nav's dateline, the tape's heading, a card's
 *    section label — but it never sits above a heading again. Stacked over an
 *    h1 it said the page's name twice.
 *  - **No second title.** "What's in motion", "Loose thoughts" — the linen era
 *    gave each page a display line under its name. They are gone; a subtitle
 *    survives only where it carries an instruction (/inbox).
 *  - **No divider.** The 64px the shell puts above the header (AppHeader's
 *    `mb-16`) is the separation. A rule under the title was the last piece of
 *    the legacy silhouette still standing.
 *
 * The h1 is 36px — one ramp step below Today's 56px hero — so a list page can
 * never out-shout the day. On a phone it steps to 30 and the right-hand cluster
 * takes its own row rather than the measure shrinking.
 *
 * Pass 4.5 Gate A: attributes are `facts` (plain `ink-3`), counts are `measure`
 * (tabular figure + word). Facts sit before measure. Do not stuff attributes
 * into Measure with an empty label.
 */

/**
 * One reading in the measure: a figure and the word it counts.
 *
 * `attention` spends the one orange, and it means what it always means — this
 * needs you. `3 need review`, `2 overdue`. Never used to make a count look
 * important (DESIGN.md, "The One Orange Rule"). Never used for plain attributes
 * — those are `facts`.
 */
export type Measure = {
	count: number | string;
	label: string;
	attention?: boolean;
};

function MeasureLine({ items }: { items: Measure[] }) {
	return (
		<>
			{items.map((item, i) => (
				<span
					// Keyed by position: lists are built in one place per page and
					// never reordered; labels alone are not always unique.
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed, caller-ordered list.
					key={i}
					className={`whitespace-nowrap ${item.attention ? "text-accent" : ""}`}
				>
					<span
						className={`mr-1 font-medium tabular-nums ${item.attention ? "text-accent" : "text-ink-2"}`}
					>
						{item.count}
					</span>
					{item.label}
				</span>
			))}
		</>
	);
}

function FactsLine({ items }: { items: ReactNode[] }) {
	return (
		<>
			{items.map((item, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed, caller-ordered list.
				<span key={i} className="whitespace-nowrap">
					{item}
				</span>
			))}
		</>
	);
}

export function PageHeader({
	title,
	facts,
	measure,
	action,
	subtitle,
}: {
	/** Usually the page's name. A node so a route whose title *is* data can hand
	 *  in a placeholder that sits inside this same h1 (see PageSkeleton). */
	title: ReactNode;
	/**
	 * Plain attribute readings on the title's baseline — relationship, type,
	 * status — at body-small `ink-3`, no tabular-nums. Sit before the measure.
	 * Pass 4.5 Gate A.
	 */
	facts?: ReactNode[];
	/** The page's own count reading. Omit rather than inventing a count to fill it. */
	measure?: Measure[];
	/** One standing action, right-aligned on the title's baseline. */
	action?: ReactNode;
	/** Only where it carries an instruction — not as a tagline. */
	subtitle?: ReactNode;
}) {
	const hasFacts = Boolean(facts && facts.length > 0);
	const hasMeasure = Boolean(measure && measure.length > 0);
	const hasReading = hasFacts || hasMeasure;
	const hasRight = hasReading || Boolean(action);

	return (
		<header className="mb-[26px] lg:mb-[30px]">
			{/* Whether the right-hand cluster may leave the title's line is decided
			    by what is in it, not by the breakpoint.

			    A reading (facts / measure) is running text and needs the width, so
			    at 393pt it drops to its own row as one cluster with the action —
			    never split measure left / action right across the full width.
			    An action on its own never wraps: a lone 32px circle under the
			    title is an orphan (ADR-0042). */}
			<div
				className={`flex items-center justify-between gap-3 lg:gap-8 ${
					hasReading ? "flex-wrap" : "flex-nowrap"
				}`}
			>
				{/* min-w-0 so a long name wraps its own text rather than pushing the
				    action off the right edge — the h1 is the flexible half. */}
				<h1 className="m-0 min-w-0 text-pretty text-t30 text-ink lg:text-t36">{title}</h1>
				{hasRight && (
					// Measure + action are one tight cluster, always. `items-center`
					// keeps the pill + on the same optical middle as the count
					// figures — baseline + translate-y was drifting them apart.
					<div className="ml-auto flex shrink-0 items-center gap-3">
						{hasReading && (
							<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
								{hasFacts && facts && <FactsLine items={facts} />}
								{hasMeasure && measure && <MeasureLine items={measure} />}
							</div>
						)}
						{action}
					</div>
				)}
			</div>
			{subtitle && (
				<p className="mt-2.5 max-w-[62ch] text-sm leading-[1.55] text-ink-2">{subtitle}</p>
			)}
		</header>
	);
}
