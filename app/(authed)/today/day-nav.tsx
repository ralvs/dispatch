"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatDay, shiftDay } from "@/lib/dates";

// Day selection is client-owned (DayView) so flipping a day only reloads the
// schedule payload — not the full Today RSC / loading.tsx. `?d=` still updates
// via history for shareable URLs and SoftRefresh.

/** The bordered chevron stays 28×28; hit-area grows the tap target to 44px. */
const STEP =
	"inline-flex size-7 shrink-0 items-center justify-center rounded-pill border border-line-strong text-ink-3 transition-colors hover:border-ink-4 hover:text-ink active:opacity-70 disabled:opacity-40";

/** Every label variant stacks in the same grid cell. */
const CELL = "col-start-1 row-start-1 min-w-0 text-center";

/**
 * The longest date the label can ever hold: the longest weekday, a two-digit
 * day, the longest month. In a monospace face every date of that shape is
 * exactly as wide, so this is the reservation, not an estimate. The desktop
 * variant appends a four-digit year.
 */
const WIDEST_DAY = "WEDNESDAY, 00 SEPTEMBER";

/**
 * The nav IS the dateline. A separate widget above the tape would state the day
 * twice, so the chevrons flank the date that was already there — the eyebrow on
 * desktop, the app bar on a phone.
 *
 * The label always names the real date and never switches to "Tomorrow".
 * Being off today is carried by the Today reset existing at all, which keeps
 * the label purely informative instead of changing voice with the mode. On
 * today the reset holds its slot invisibly, so the chevrons never shift.
 */
export function DayNav({
	dateIso,
	todayIso,
	pending,
	onSelect,
}: {
	dateIso: string;
	todayIso: string;
	pending?: boolean;
	onSelect: (dateIso: string) => void;
}) {
	const isToday = dateIso === todayIso;

	return (
		<nav
			className="flex min-w-0 items-center gap-1.5 lg:gap-2"
			aria-label="Day navigation"
			aria-busy={pending || undefined}
		>
			<button
				type="button"
				className={`${STEP} hit-area [--hit-x:8.5px] [--hit-y:8.5px]`}
				aria-label="Previous day"
				disabled={pending}
				onClick={() => onSelect(shiftDay(dateIso, -1))}
			>
				<Icon icon={ChevronLeft} size="sm" strokeWidth={1.8} />
			</button>
			{/* A one-cell grid: the invisible widest-case date sets the width, the
			    real one is laid over it. Measured rather than computed in `ch` so
			    the reservation survives the font and the tracking changing under
			    it. Every date is narrower, so the next chevron never moves. */}
			<p
				className="grid min-w-0 font-mono text-eyebrow uppercase tracking-widest text-ink-3"
				aria-live="polite"
			>
				{/* Long form where there is room; the phone's app bar drops the year,
				    which is the one part of the date nobody is checking. */}
				<span className={`${CELL} truncate lg:hidden`}>
					{formatDay(dateIso, "utc", "cccc, d LLLL")}
				</span>
				<span className={`${CELL} hidden truncate lg:block`}>
					{formatDay(dateIso, "utc", "cccc, d LLLL yyyy")}
				</span>
				<span className={`${CELL} invisible lg:hidden`} aria-hidden="true">
					{WIDEST_DAY}
				</span>
				<span className={`${CELL} invisible hidden lg:block`} aria-hidden="true">
					{WIDEST_DAY} 0000
				</span>
			</p>
			<button
				type="button"
				className={`${STEP} hit-area [--hit-x:8.5px] [--hit-y:8.5px]`}
				aria-label="Next day"
				disabled={pending}
				onClick={() => onSelect(shiftDay(dateIso, 1))}
			>
				<Icon icon={ChevronRight} size="sm" strokeWidth={1.8} />
			</button>
			{/* Holds its slot on today — visibility, not display — so the chevrons
			    and the label never shift when the day changes under them. */}
			<button
				type="button"
				disabled={pending || isToday}
				aria-hidden={isToday}
				tabIndex={isToday ? -1 : undefined}
				onClick={() => onSelect(todayIso)}
				className={button({
					shape: "pill",
					variant: "outline",
					size: "sm",
					className: `ml-1 h-7 px-3 ${isToday ? "invisible" : ""}`,
				})}
			>
				Today
			</button>
		</nav>
	);
}
