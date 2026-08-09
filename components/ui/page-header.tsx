import type { ReactNode } from "react";

/**
 * The page header — revision A, option D, chosen at the Pass 0 gate
 * (.impeccable/mocks/chrome-header-lab.html, docs/adr/0042).
 *
 * Four slots, in one line where there is room: **title · measure · action**,
 * with an optional subtitle beneath.
 *
 *   Projects                              14 open   3 paused
 *   Notes                    128 notes  3 need review   [+ New note]
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
 */

/**
 * One reading in the measure: a figure and the word it counts.
 *
 * `attention` spends the one orange, and it means what it always means — this
 * needs you. `3 need review`, `2 overdue`. Never used to make a count look
 * important (DESIGN.md, "The One Orange Rule").
 */
export type Measure = {
	count: number | string;
	label: string;
	attention?: boolean;
};

function MeasureLine({ items }: { items: Measure[] }) {
	return (
		<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-ink-3">
			{items.map((item, i) => (
				<span
					// Keyed by position: the two detail pages pass attribute readings
					// with an empty label, so labels are not unique. The list is built
					// in one place per page and never reordered.
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
		</div>
	);
}

export function PageHeader({
	title,
	measure,
	action,
	subtitle,
}: {
	/** Usually the page's name. A node so a route whose title *is* data can hand
	 *  in a placeholder that sits inside this same h1 (see PageSkeleton). */
	title: ReactNode;
	/** The page's own reading. Omit it rather than inventing a count to fill it. */
	measure?: Measure[];
	/** One standing action, right-aligned on the title's baseline. */
	action?: ReactNode;
	/** Only where it carries an instruction — not as a tagline. */
	subtitle?: ReactNode;
}) {
	const hasMeasure = Boolean(measure && measure.length > 0);
	const hasRight = hasMeasure || Boolean(action);

	return (
		<header className="mb-[26px] lg:mb-[30px]">
			{/* Whether the right-hand cluster may leave the title's line is decided
			    by what is in it, not by the breakpoint.

			    A measure is running text and needs the width, so at 393pt it drops
			    to its own row with the action beside it, which is what ADR-0042
			    chose over shrinking the reading. An action on its own needs no
			    width worth taking a row for — a 32px control that wraps below a
			    30px title leaves a band of empty ground with one circle floating in
			    it, and the control changes its relationship to the title depending
			    on how wide the window is. So it never wraps: `flex-nowrap` holds it
			    on the title's line at every width, and the h1 gives up the room. */}
			<div
				className={`flex items-baseline justify-between gap-3 lg:flex-nowrap lg:gap-8 ${
					hasMeasure ? "flex-wrap" : "flex-nowrap"
				}`}
			>
				{/* min-w-0 so a long name wraps its own text rather than pushing the
				    action off the right edge — the h1 is the flexible half. */}
				<h1 className="m-0 min-w-0 text-pretty text-t30 text-ink lg:text-t36">{title}</h1>
				{hasRight && (
					<div
						className={
							hasMeasure
								? "flex w-full items-baseline justify-between gap-5 lg:w-auto lg:shrink-0 lg:justify-end"
								: // No measure: the cluster is only as wide as its control and
									// centres on the title's line box, which is what puts a
									// circular glyph on the title's optical middle.
									"flex shrink-0 items-center gap-5 self-center"
						}
					>
						{hasMeasure && measure && <MeasureLine items={measure} />}
						{/* Baseline alignment would drop a 36px-tall control below the
						    text line; centre it and nudge, so its cap-height rides the
						    h1's baseline instead. Only needed where the measure sets the
						    cluster's baseline — alone, the cluster is already centred. */}
						{action &&
							(hasMeasure ? <div className="translate-y-[3px] self-center">{action}</div> : action)}
					</div>
				)}
			</div>
			{subtitle && (
				<p className="mt-2.5 max-w-[62ch] text-sm leading-[1.55] text-ink-2">{subtitle}</p>
			)}
		</header>
	);
}
