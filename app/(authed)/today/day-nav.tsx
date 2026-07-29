import Link from "next/link";
import { formatDay, formatDayNavLabel, shiftDay } from "@/lib/dates";

// Today reads a day at a time. The selected date lives in the URL (`?d=`)
// rather than in client state so the whole schedule — tape, bands and the
// task column — re-reads from the server as one, and a particular day stays
// linkable and survives a reload. `?d=<today>` normalizes to a bare /today.
function hrefFor(dateIso: string, todayIso: string): string {
	return dateIso === todayIso ? "/today" : `/today?d=${dateIso}`;
}

function IconChevron({ direction }: { direction: "left" | "right" }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="14"
			height="14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} />
		</svg>
	);
}

const STEP =
	"inline-flex h-7 w-7 items-center justify-center rounded border border-line text-ink-3 hover:border-line-strong hover:text-ink";

export function DayNav({ dateIso, todayIso }: { dateIso: string; todayIso: string }) {
	const previous = shiftDay(dateIso, -1);
	const next = shiftDay(dateIso, 1);
	const isToday = dateIso === todayIso;

	return (
		<nav className="flex items-center gap-2" aria-label="Day navigation">
			<Link href={hrefFor(previous, todayIso)} className={STEP} aria-label="Previous day">
				<IconChevron direction="left" />
			</Link>
			<p
				className="min-w-28 text-center font-mono text-eyebrow uppercase tracking-widest text-ink-2"
				aria-live="polite"
			>
				{/* The relative word is the quick read; the full date is what a
				 * screen reader and a hover both get. */}
				<span title={formatDay(dateIso, "utc")}>{formatDayNavLabel(dateIso, todayIso)}</span>
			</p>
			<Link href={hrefFor(next, todayIso)} className={STEP} aria-label="Next day">
				<IconChevron direction="right" />
			</Link>
			{!isToday && (
				<Link
					href="/today"
					className="ml-1 rounded border border-line px-2 py-1 font-mono text-meta uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink"
				>
					Today
				</Link>
			)}
		</nav>
	);
}
