/**
 * The cadence bar under a brief line: a 3px track where neutral fill runs up
 * to the expected cadence, ship-gradient fill shows the overflow past it, and a
 * vertical tick marks the threshold. Pure divs, no SVG.
 */
export function CadenceBar({
	daysSince,
	thresholdDays,
}: {
	daysSince: number;
	thresholdDays: number;
}) {
	// The track spans up to 2× the threshold so deep slips don't stretch forever.
	const span = Math.max(thresholdDays * 2, daysSince, 1);
	const shown = Math.min(daysSince, span);
	const neutralPct = (Math.min(shown, thresholdDays) / span) * 100;
	const overflowPct = (Math.max(shown - thresholdDays, 0) / span) * 100;
	const tickPct = (thresholdDays / span) * 100;

	return (
		<div className="relative mt-2 h-[3px] w-full bg-line-strong" aria-hidden>
			<div className="absolute left-0 top-0 h-full bg-ink-3" style={{ width: `${neutralPct}%` }} />
			<div
				className="absolute top-0 h-full bg-accent"
				style={{ left: `${neutralPct}%`, width: `${overflowPct}%` }}
			/>
			<div className="absolute top-[-2px] h-[7px] w-px bg-ink-2" style={{ left: `${tickPct}%` }} />
		</div>
	);
}
