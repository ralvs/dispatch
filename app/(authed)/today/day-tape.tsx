import type { CSSProperties } from "react";
import type { DayScheduleItem } from "@/lib/services/briefing";
import { isTop3Today } from "@/lib/task-predicates";

/** Fallback window when the timeline is empty (still includes `now`). */
const DEFAULT_START_MIN = 8 * 60;
const DEFAULT_END_MIN = 20 * 60;
/** Breathing room around the earliest/latest point so flags aren't at the edge. */
const PAD_MIN = 60;
/** Keep the ruler readable when everything clusters in a short span. */
const MIN_SPAN_MIN = 6 * 60;

function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

/**
 * Shrink the day tape to the hours that matter: events/tasks on the timeline
 * plus the current time, with padding. Avoids a sparse 06:00–24:00 ruler when
 * nothing happens early or late.
 */
export function computeTapeRange(
	itemMinutes: number[],
	/** Null on any day but today — a past or future tape has no "now" to fit. */
	nowMinutes: number | null,
): { startMin: number; endMin: number; ticks: number[] } {
	const points = [...itemMinutes, nowMinutes ?? Number.NaN].filter((m) => Number.isFinite(m));
	if (points.length === 0) {
		return {
			startMin: DEFAULT_START_MIN,
			endMin: DEFAULT_END_MIN,
			ticks: buildTicks(DEFAULT_START_MIN, DEFAULT_END_MIN),
		};
	}

	let start = Math.min(...points) - PAD_MIN;
	let end = Math.max(...points) + PAD_MIN;
	// Snap to whole hours so tick labels stay clean.
	start = Math.floor(start / 60) * 60;
	end = Math.ceil(end / 60) * 60;

	if (end - start < MIN_SPAN_MIN) {
		const extra = MIN_SPAN_MIN - (end - start);
		const before = Math.floor(extra / 2);
		start -= before;
		end += extra - before;
		start = Math.floor(start / 60) * 60;
		end = Math.ceil(end / 60) * 60;
	}

	start = Math.max(0, start);
	end = Math.min(24 * 60, end);
	if (end - start < 60) {
		end = Math.min(24 * 60, start + 60);
	}

	return { startMin: start, endMin: end, ticks: buildTicks(start, end) };
}

function buildTicks(startMin: number, endMin: number): number[] {
	const startH = startMin / 60;
	const endH = endMin / 60;
	const spanH = endH - startH;
	const step = spanH >= 9 ? 3 : spanH >= 5 ? 2 : 1;
	const ticks: number[] = [];
	for (let h = startH; h < endH - 1e-9; h += step) {
		ticks.push(h);
	}
	if (ticks.length === 0 || ticks[ticks.length - 1] !== endH) {
		ticks.push(endH);
	}
	return ticks;
}

function tapePct(minutes: number, startMin: number, endMin: number): number {
	const span = endMin - startMin || 1;
	const clamped = Math.min(Math.max(minutes, startMin), endMin);
	return ((clamped - startMin) / span) * 100;
}

/** A notional tape width used only to turn `left%` into a comparable px
 * space for collision math below — never for actual layout. Picking a fixed
 * number (rather than reading the real DOM width) keeps lane assignment a
 * pure function of the day's data, so server and client always agree. */
const ASSUMED_TAPE_WIDTH_PX = 600;
/** Rough per-character width for the tape's 9px mono labels. An estimate
 * from character count avoids a DOM measurement pass, which would have to
 * run after mount and could disagree with the server-rendered layout. */
const CHAR_WIDTH_PX = 5.4;
/** Matches `.dt-flag-label { padding: 0 3px }`. */
const LABEL_H_PADDING_PX = 6;
/** Space between two labels' boxes before they count as colliding. */
const LANE_GUTTER_PX = 5;
/** Vertical distance between stacked lanes. */
const LANE_HEIGHT_PX = 22;
/** Matches `.dt-flag-title { max-width: 150px }` at the ≥48rem breakpoint —
 * the widest a title line ever gets, so lane assignment (which can't see the
 * viewport) stays safe at the size where titles actually render. */
const MAX_TITLE_WIDTH_PX = 150;

/** Estimated half-width (px, in the assumed tape space) of a flag's label —
 * the wider of its title line and its time line, since the two stack. */
function estimateHalfWidthPx(title: string, timeGlyphChars: number): number {
	const titleWidth = Math.min(title.length * CHAR_WIDTH_PX, MAX_TITLE_WIDTH_PX);
	const timeWidth = timeGlyphChars * CHAR_WIDTH_PX;
	return Math.max(titleWidth, timeWidth) / 2 + LABEL_H_PADDING_PX;
}

/**
 * Greedy interval coloring: sorted left-to-right, each label drops into the
 * first lane whose last-placed label doesn't overlap it, or opens a new lane.
 * Deterministic in input order, so it renders identically on server and
 * client. Returns a lane index per input (same order as `items`) plus the
 * deepest lane used.
 */
function assignLanes(items: { leftPx: number; halfWidthPx: number }[]): {
	lanes: number[];
	maxLane: number;
} {
	const order = items.map((item, i) => ({ ...item, i })).sort((a, b) => a.leftPx - b.leftPx);
	const laneRightEdge: number[] = [];
	const lanes = new Array(items.length).fill(0);
	for (const item of order) {
		const left = item.leftPx - item.halfWidthPx - LANE_GUTTER_PX;
		const right = item.leftPx + item.halfWidthPx + LANE_GUTTER_PX;
		let lane = laneRightEdge.findIndex((edge) => edge <= left);
		if (lane === -1) {
			lane = laneRightEdge.length;
			laneRightEdge.push(right);
		} else {
			laneRightEdge[lane] = right;
		}
		lanes[item.i] = lane;
	}
	return { lanes, maxLane: Math.max(0, laneRightEdge.length - 1) };
}

const TAPE_CSS = `
.dt-tape {
	position: relative;
	/* --dt-lanes-up/down (set inline, per render) is the deepest collision
	 * lane on each side beyond the first — 0 when nothing collides, so this
	 * reduces to the original fixed padding in the common case. */
	padding-top: calc(64px + var(--dt-lanes-up, 0) * 22px);
	padding-bottom: calc(52px + var(--dt-lanes-down, 0) * 22px);
}

.dt-axis {
	position: relative;
	height: 2px;
	background: var(--line);
}

.dt-tick {
	position: absolute;
	top: -3px;
	width: 1px;
	height: 8px;
	background: var(--line-strong);
}

.dt-tick-label {
	position: absolute;
	top: 10px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
	letter-spacing: 0.04em;
	color: var(--ink-3);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}

.dt-now {
	position: absolute;
	top: -46px;
	width: 2px;
	height: 56px;
	z-index: 0;
	background: var(--accent);
	transform: translateX(-1px);
}

.dt-now-label {
	position: absolute;
	top: -60px;
	z-index: 2;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--accent-ink);
	white-space: nowrap;
}

.dt-flag-stem {
	position: absolute;
	width: 1px;
	background: var(--line);
}

.dt-flag-stem.tier-up {
	bottom: 2px;
	height: 14px;
}

.dt-flag-stem.tier-down {
	top: 2px;
	height: 14px;
}

.dt-flag-dot {
	position: absolute;
	top: 0;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--ink-3);
	transform: translate(-50%, -50%);
}

.dt-flag-dot.is-top3 {
	background: var(--warning);
}

.dt-flag-dot.is-done {
	background: var(--success);
}

/* An event that has ended stays on the tape — it just stops competing with
 * what is still ahead. Matches the past-row treatment in timeline-row.tsx. */
.dt-flag-dot.is-past,
.dt-flag-stem.is-past {
	opacity: 0.5;
}

.dt-flag-label.is-past,
.dt-flag-label.is-past .dt-flag-title {
	color: var(--ink-4);
}

.dt-flag-label {
	position: absolute;
	z-index: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	background: var(--bg);
	padding: 0 3px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
	line-height: 1.4;
	color: var(--ink-3);
	white-space: nowrap;
	font-variant-numeric: tabular-nums;
}

.dt-flag-label.tier-up {
	bottom: 18px;
}

/*
 * Below the axis the pair mirrors: the time stays the line nearest the ruler
 * (so a flag's time always sits beside its dot) and the title moves outward.
 * Reversed visually only — the DOM keeps title-then-time reading order.
 */
.dt-flag-label.tier-down {
	top: 32px;
	flex-direction: column-reverse;
}

.dt-flag-title {
	display: none;
}

@media (min-width: 48rem) {
	.dt-tape {
		padding-top: calc(72px + var(--dt-lanes-up, 0) * 22px);
		/* Two-line flags (title over time) hang lower than the old single line. */
		padding-bottom: calc(72px + var(--dt-lanes-down, 0) * 22px);
	}

	.dt-flag-title {
		display: block;
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--ink-2);
	}
}
`;

function formatTickHour(h: number): string {
	// 24:00 is a valid right edge when the window reaches midnight.
	if (h === 24) return "24:00";
	const whole = Math.floor(h);
	const mins = Math.round((h - whole) * 60);
	return `${String(whole).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** A horizontal ruler for the day's timed events and tasks — window fits the day. */
export function DayTape({
	timeline,
	dateIso,
	nowLabel,
	nowUtcIso,
	nav,
}: {
	timeline: DayScheduleItem[];
	/** The day this tape draws — today unless the day nav has moved. */
	dateIso: string;
	/** Day navigation, rendered in the heading row so one control heads the section. */
	nav?: React.ReactNode;
	/** Wall-clock "now" in the app timezone, or null when the tape isn't today's. */
	nowLabel: string | null;
	/** Wall-clock "now" as UTC ISO — dims events that have already ended. */
	nowUtcIso?: string;
}) {
	const flags = timeline
		.filter((item): item is DayScheduleItem & { time: string } => item.time !== null)
		.map((item, i) => {
			const title = item.kind === "task" ? item.task.title : item.event.title;
			const top3 = item.kind === "task" && isTop3Today(item.task, dateIso);
			const done = item.kind === "task" && item.task.status === "done";
			// Only events go quiet once they end — an overdue task is still work
			// to do, so it keeps its weight.
			const past = Boolean(
				item.kind === "event" && nowUtcIso && Date.parse(item.event.end_at) < Date.parse(nowUtcIso),
			);
			return {
				key: item.key,
				time: item.time,
				title,
				top3,
				done,
				past,
				tier: i % 2 === 0 ? "tier-up" : "tier-down",
			};
		});

	const nowMinutes = nowLabel === null ? null : toMinutes(nowLabel);
	const { startMin, endMin, ticks } = computeTapeRange(
		flags.map((f) => toMinutes(f.time)),
		nowMinutes,
	);
	const pct = (m: number) => tapePct(m, startMin, endMin);

	// Lanes are assigned per tier: tier-up and tier-down labels sit on
	// opposite sides of the axis and never compete with each other, only with
	// their own side. Each tier's deepest lane grows that side's padding.
	const upItems = flags
		.map((f, i) => ({ f, i }))
		.filter(({ f }) => f.tier === "tier-up")
		.map(({ f, i }) => ({
			leftPx: (pct(toMinutes(f.time)) / 100) * ASSUMED_TAPE_WIDTH_PX,
			halfWidthPx: estimateHalfWidthPx(f.title, f.time.length + (f.top3 || f.done ? 2 : 0)),
			i,
		}));
	const downItems = flags
		.map((f, i) => ({ f, i }))
		.filter(({ f }) => f.tier === "tier-down")
		.map(({ f, i }) => ({
			leftPx: (pct(toMinutes(f.time)) / 100) * ASSUMED_TAPE_WIDTH_PX,
			halfWidthPx: estimateHalfWidthPx(f.title, f.time.length + (f.top3 || f.done ? 2 : 0)),
			i,
		}));
	const upLanes = assignLanes(upItems);
	const downLanes = assignLanes(downItems);
	const lanesByIndex = new Map<number, number>();
	upItems.forEach((item, order) => {
		lanesByIndex.set(item.i, upLanes.lanes[order]);
	});
	downItems.forEach((item, order) => {
		lanesByIndex.set(item.i, downLanes.lanes[order]);
	});

	// Extra reserve beyond the CSS defaults' single lane, funneled in as a
	// custom property so both breakpoints' padding rules can add it via calc().
	const tapeStyle = {
		"--dt-lanes-up": upLanes.maxLane,
		"--dt-lanes-down": downLanes.maxLane,
	} as CSSProperties;

	return (
		// The heading + day nav stay real, accessible controls — only the ruler
		// below is hidden (see the aria-hidden div): the same events are already
		// exposed accessibly as real <ul>/<li> rows by DaySchedule on this page,
		// so a screen reader should skip the redundant visual duplicate but not
		// the actual "change day" navigation that happens to live in this section.
		<section className="mt-14">
			<div className="flex items-center justify-between gap-4">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Day tape</h2>
				{nav}
			</div>
			<style>{TAPE_CSS}</style>
			<div className="dt-tape mt-2" style={tapeStyle} aria-hidden="true">
				<div className="dt-axis">
					{ticks.map((h) => (
						<div key={h} className="dt-tick" style={{ left: `${pct(h * 60)}%` }} />
					))}
					{ticks.map((h) => (
						<div key={`l-${h}`} className="dt-tick-label" style={{ left: `${pct(h * 60)}%` }}>
							{formatTickHour(h)}
						</div>
					))}
					{flags.map((item, i) => {
						const left = pct(toMinutes(item.time));
						const past = item.past ? " is-past" : "";
						const dotClass = item.done
							? "dt-flag-dot is-done"
							: item.top3
								? "dt-flag-dot is-top3"
								: "dt-flag-dot";
						// Deeper lanes push the label further from the axis — "down" on
						// the tier-up side means further up, so the offset still adds.
						const lane = lanesByIndex.get(i) ?? 0;
						const laneOffset = lane * LANE_HEIGHT_PX;
						const labelStyle =
							item.tier === "tier-up"
								? { left: `${left}%`, bottom: `${18 + laneOffset}px` }
								: { left: `${left}%`, top: `${32 + laneOffset}px` };
						return (
							<div key={item.key}>
								<div className={`dt-flag-stem ${item.tier}${past}`} style={{ left: `${left}%` }} />
								<div className={`${dotClass}${past}`} style={{ left: `${left}%` }} />
								<div className={`dt-flag-label ${item.tier}${past}`} style={labelStyle}>
									<span className="dt-flag-title">{item.title}</span>
									<span>
										{item.time}
										{item.top3 && !item.done && <span className="text-warning"> ★</span>}
										{/* Color alone (the dot) isn't enough to say "done" — pair it with a glyph,
										 * matching the ★ precedent above and task-fields.tsx's color+label rule. */}
										{item.done && <span className="text-success"> ✓</span>}
									</span>
								</div>
							</div>
						);
					})}
					{nowMinutes !== null && nowLabel !== null && (
						<>
							<div className="dt-now" style={{ left: `${pct(nowMinutes)}%` }} />
							<div className="dt-now-label" style={{ left: `${pct(nowMinutes)}%` }}>
								now {nowLabel}
							</div>
						</>
					)}
				</div>
			</div>
		</section>
	);
}
