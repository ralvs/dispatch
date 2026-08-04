"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { formatDay, formatDayNavLabel, shiftDay } from "@/lib/dates";

// Day selection is client-owned (DayView) so flipping a day only
// reloads the schedule payload — not the full Today RSC / loading.tsx.
// `?d=` still updates via history for shareable URLs and SoftRefresh.

// The bordered button stays 28×28; hit-area grows the tap target to 44px.
const STEP =
	"inline-flex h-7 w-7 items-center justify-center rounded-control border border-line text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70 disabled:opacity-40";

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
	const previous = shiftDay(dateIso, -1);
	const next = shiftDay(dateIso, 1);
	const isToday = dateIso === todayIso;

	return (
		<nav
			className="flex items-center gap-2"
			aria-label="Day navigation"
			aria-busy={pending || undefined}
		>
			{/* An invisible same-size placeholder holds this slot on today so the
			 * arrows/label never shift when the day changes — the real button
			 * only mounts once there's somewhere for it to go. */}
			{isToday ? (
				<span aria-hidden="true" className="inline-flex h-7 items-center px-2 text-meta invisible">
					Today
				</span>
			) : (
				<button
					type="button"
					disabled={pending}
					onClick={() => onSelect(todayIso)}
					className="inline-flex h-7 items-center rounded-control border border-line px-2 font-mono text-meta uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70 disabled:opacity-40"
				>
					Today
				</button>
			)}
			<span className="hit-area inline-flex [--hit-x:8.5px] [--hit-y:8.5px]">
				<button
					type="button"
					className={STEP}
					aria-label="Previous day"
					disabled={pending}
					onClick={() => onSelect(previous)}
				>
					<Icon icon={ChevronLeft} size="sm" />
				</button>
			</span>
			<p
				className="min-w-28 text-center font-mono text-eyebrow uppercase tracking-widest text-ink-2"
				aria-live="polite"
			>
				{/* The relative word is the quick read; the full date is what a
				 * screen reader and a hover both get. */}
				<span title={formatDay(dateIso, "utc")}>{formatDayNavLabel(dateIso, todayIso)}</span>
			</p>
			<span className="hit-area inline-flex [--hit-x:8.5px] [--hit-y:8.5px]">
				<button
					type="button"
					className={STEP}
					aria-label="Next day"
					disabled={pending}
					onClick={() => onSelect(next)}
				>
					<Icon icon={ChevronRight} size="sm" />
				</button>
			</span>
		</nav>
	);
}
