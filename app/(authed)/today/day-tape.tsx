"use client";

import { type PointerEvent, useCallback, useState } from "react";
import type { DayScheduleEventItem, DayScheduleItem } from "@/lib/day-schedule";
import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";
import { type DomainColorSource, eventColor } from "@/lib/ui/event-color";

/*
 * The day tape: a proportional measure of one day, 06:00–22:00. Committed time
 * is a filled block in its own colour, free time is empty, and the now-mark
 * carries its own hour in ink.
 *
 * The window is PINNED rather than fitted to the day's contents. A window that
 * shrinks to whatever happens to be scheduled makes a 30-minute meeting a
 * different width every morning, which is the one thing a proportional measure
 * must not do — you learn the shape of a full day by seeing it against the
 * same 960 minutes each time. It only ever widens, and only to contain
 * something that falls outside.
 *
 * Titles never go inside the blocks. At 1092px the tape runs 1.14px per minute,
 * so a 30-minute meeting gets 34px against the 141px its title needs; at 393pt
 * it is 11px. Start times ride above the track on desktop, and every title
 * lives in the Timeline list directly below — which was always the tape's
 * contract. Evidence: .impeccable/mocks/tape-lab.html.
 *
 * Hover (fine pointer only) draws a quiet scrub line and prints the wall-clock
 * at that x on the ruler below the track, where every other clock reading on
 * the tape already lives. Above the track belongs to the events' own start
 * times. It is orientation, not data — nothing moves, nothing is selected.
 */

/** The pinned window: 06:00–22:00, 960 minutes. */
export const TAPE_START_MIN = 6 * 60;
export const TAPE_END_MIN = 22 * 60;
/** Hours between ruler ticks. */
const TICK_STEP_H = 3;
/** The one intermediate tick the phone keeps, alongside both ends and now. */
const PHONE_LANDMARK_H = 18;

function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

/**
 * The window actually drawn. Starts at the pinned 06:00–22:00 and widens
 * outward to whole hours so nothing on the day — including `now` — is ever
 * clamped to an edge and drawn in the wrong place.
 */
export function computeTapeWindow(
	itemMinutes: number[],
	/** Null on any day but today: a past or future tape has no "now" to fit. */
	nowMinutes: number | null,
): { startMin: number; endMin: number; ticks: number[] } {
	const points = [...itemMinutes, nowMinutes ?? Number.NaN].filter((m) => Number.isFinite(m));

	let start = TAPE_START_MIN;
	let end = TAPE_END_MIN;
	for (const point of points) {
		if (point < start) start = Math.floor(point / 60) * 60;
		if (point > end) end = Math.ceil(point / 60) * 60;
	}
	start = Math.max(0, start);
	end = Math.min(24 * 60, end);

	const ticks: number[] = [];
	for (let h = start / 60; h < end / 60 - 1e-9; h += TICK_STEP_H) ticks.push(h);
	if (ticks[ticks.length - 1] !== end / 60) ticks.push(end / 60);

	return { startMin: start, endMin: end, ticks };
}

function pct(minutes: number, startMin: number, endMin: number): number {
	const span = endMin - startMin || 1;
	return ((Math.min(Math.max(minutes, startMin), endMin) - startMin) / span) * 100;
}

export type TapeBlock = {
	key: string;
	kind: "event" | "task";
	startMin: number;
	/** Zero for a task — a scheduled task is a point in time, not a span. */
	durationMin: number;
	color: string;
	time: string;
	/** Row this block sits in, 0-based, when its cluster stacks. */
	lane: number;
	/** How many rows its cluster splits the track into. 1 = full height. */
	lanes: number;
};

/** The day's timed items as positioned blocks. Pure, so SSR and the client agree. */
export function tapeBlocks(
	timeline: DayScheduleItem[],
	domains: readonly DomainColorSource[] = [],
): TapeBlock[] {
	const blocks: TapeBlock[] = [];
	for (const item of timeline) {
		if (item.time === null) continue;
		if (item.kind === "event") {
			const ms = Date.parse(item.event.end_at) - Date.parse(item.event.start_at);
			blocks.push({
				key: item.key,
				kind: "event",
				startMin: toMinutes(item.time),
				durationMin: Number.isFinite(ms) ? Math.max(0, Math.round(ms / 60_000)) : 0,
				color: eventColor(item.event.calendar_name, domains),
				time: item.time,
				lane: 0,
				lanes: 1,
			});
		} else {
			const slug = item.task.domain?.color;
			blocks.push({
				key: item.key,
				kind: "task",
				startMin: toMinutes(item.time),
				durationMin: 0,
				color: isColorSlug(slug) ? colorSlugVar(slug) : "var(--ink-3)",
				time: item.time,
				lane: 0,
				lanes: 1,
			});
		}
	}
	return assignTapeLanes(blocks.sort((a, b) => a.startMin - b.startMin));
}

/**
 * Two meetings at the same hour used to be one block: the later one simply
 * drew over the earlier, so a double-booked morning read as a single
 * commitment. Overlapping events now split the track into rows instead.
 *
 * The split is per cluster, not per day. A run of events that touch each other
 * gets as many rows as its busiest moment needs, and the rest of the tape keeps
 * full-height blocks — so one double-booking at 09:00 does not halve every
 * other meeting on the day. Blocks that only meet end-to-start do not overlap
 * and stay in one row.
 *
 * Tasks take no part: a scheduled task is a point in time, not a span, and its
 * tick stays full height so the shape still tells you which is which.
 *
 * Mutates in place and returns the same array — it is only ever called on the
 * freshly built list above, and staying pure in its inputs keeps SSR and the
 * client in agreement.
 */
export function assignTapeLanes(blocks: TapeBlock[]): TapeBlock[] {
	const spans = blocks.filter((b) => b.kind === "event" && b.durationMin > 0);
	let cluster: TapeBlock[] = [];
	let laneEnds: number[] = [];
	let clusterEnd = Number.NEGATIVE_INFINITY;

	const closeCluster = () => {
		const lanes = Math.max(1, laneEnds.length);
		for (const b of cluster) b.lanes = lanes;
		cluster = [];
		laneEnds = [];
		clusterEnd = Number.NEGATIVE_INFINITY;
	};

	for (const b of spans) {
		if (b.startMin >= clusterEnd) closeCluster();
		const end = b.startMin + b.durationMin;
		let lane = laneEnds.findIndex((laneEnd) => laneEnd <= b.startMin);
		if (lane === -1) {
			lane = laneEnds.length;
			laneEnds.push(end);
		} else {
			laneEnds[lane] = end;
		}
		b.lane = lane;
		cluster.push(b);
		clusterEnd = Math.max(clusterEnd, end);
	}
	closeCluster();

	return blocks;
}

function formatHour(h: number): string {
	return `${String(Math.floor(h)).padStart(2, "0")}:00`;
}

/** Wall-clock label for a minute-of-day. Clamped to the calendar day. */
export function formatTapeTime(totalMin: number): string {
	const clamped = Math.max(0, Math.min(24 * 60, Math.round(totalMin)));
	const h = Math.floor(clamped / 60);
	const m = clamped % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Minute-of-day under a 0–1 position on the tape. Pure so the scrubber and any
 * test share one rounding rule: nearest minute, edges inclusive.
 */
export function minutesFromRatio(ratio: number, startMin: number, endMin: number): number {
	const t = Math.min(1, Math.max(0, ratio));
	const span = endMin - startMin || 1;
	return Math.round(startMin + t * span);
}

/**
 * A notional tape width, used only to turn a percentage into a comparable px
 * space for the collision rules below — never for layout. A fixed number
 * rather than a measured one keeps both rules pure functions of the day's
 * data, so the server and the client always agree on what is hidden.
 */
const ASSUMED_TAPE_WIDTH_PX = 1100;
/** "11:30" at 11px mono, plus the space two labels need between them. */
const TIME_LABEL_WIDTH_PX = 36;
/** How close a ruler tick may come to the now-label before it gives way. */
const NOW_CLEARANCE_PX = 46;
/** Same, for the closing hour — which is right-aligned, so it reaches further
 * back from the edge than its own centre would suggest. */
const END_CLEARANCE_PX = 78;

const pxGap = (a: number, b: number) => (Math.abs(a - b) / 100) * ASSUMED_TAPE_WIDTH_PX;

/**
 * Which start times can be printed above the track. Left to right, a label is
 * kept only if it clears the last one kept — three meetings between 11:30 and
 * 12:30 would otherwise render as "11:3012:0012:30".
 *
 * Dropping the label costs nothing: the block is still drawn in its true
 * place, and the Timeline directly below carries every time in full. The
 * label above the track is a convenience, not the record.
 */
export function visibleTimeLabels(positions: number[]): boolean[] {
	let lastKept = Number.NEGATIVE_INFINITY;
	return positions.map((p) => {
		if (pxGap(p, lastKept) < TIME_LABEL_WIDTH_PX) return false;
		lastKept = p;
		return true;
	});
}

/**
 * The tape, capped by the all-day band.
 *
 * The band is every event that takes the whole day rather than an hour of it,
 * which is precisely what the tape is structurally incapable of showing — so
 * the two sit together and read as one object: the whole day. When there is
 * nothing all-day the band is absent, not empty. A task with no hour is not
 * one of these: it has no span to draw and belongs in Open.
 *
 * The ruler is `aria-hidden`: the same events are already exposed as real list
 * rows by the Timeline below, and a screen reader should not walk the day
 * twice.
 */
export function DayTape({
	timeline,
	allDay,
	nowLabel,
	domains = [],
}: {
	timeline: DayScheduleItem[];
	/** Events only: a task with no hour is an open task, not an all-day one. */
	allDay: DayScheduleEventItem[];
	/** Wall-clock "now", or null on any day but today — no now-mark off today. */
	nowLabel: string | null;
	/** Live domain colours so a calendar named like a domain follows that slug. */
	domains?: readonly DomainColorSource[];
}) {
	const blocks = tapeBlocks(timeline, domains);
	const nowMinutes = nowLabel === null ? null : toMinutes(nowLabel);
	const { startMin, endMin, ticks } = computeTapeWindow(
		blocks.flatMap((b) => [b.startMin, b.startMin + b.durationMin]),
		nowMinutes,
	);
	const at = (m: number) => pct(m, startMin, endMin);
	const showLabel = visibleTimeLabels(blocks.map((b) => at(b.startMin)));
	const nowAt = nowMinutes === null ? null : at(nowMinutes);

	// Quiet scrubber: mouse-only. Touch has no hover, and a finger scrub would
	// fight day-nav / scroll without earning its keep.
	const [hover, setHover] = useState<{ at: number; label: string } | null>(null);
	const onPointerMove = useCallback(
		(e: PointerEvent<HTMLDivElement>) => {
			if (e.pointerType !== "mouse") return;
			const rect = e.currentTarget.getBoundingClientRect();
			if (rect.width <= 0) return;
			const minutes = minutesFromRatio((e.clientX - rect.left) / rect.width, startMin, endMin);
			const nextAt = pct(minutes, startMin, endMin);
			const nextLabel = formatTapeTime(minutes);
			setHover((prev) =>
				prev !== null && prev.at === nextAt && prev.label === nextLabel
					? prev
					: { at: nextAt, label: nextLabel },
			);
		},
		[startMin, endMin],
	);
	const onPointerLeave = useCallback(() => setHover(null), []);
	// Half a "11:30" at 11px: nearer than this to an end and the centred
	// label would be clipped, so it anchors to that edge instead.
	const hoverEdge =
		hover === null
			? undefined
			: pxGap(hover.at, 0) < TIME_LABEL_WIDTH_PX / 2
				? "start"
				: pxGap(hover.at, 100) < TIME_LABEL_WIDTH_PX / 2
					? "end"
					: undefined;

	return (
		<section className="t-day-owned mt-10" aria-label="Day tape">
			{allDay.length > 0 && (
				<div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
					<h2 className="shrink-0 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						All day
					</h2>
					{allDay.map((item) => {
						const title = item.event.title;
						const color = eventColor(item.event.calendar_name, domains);
						return (
							<span
								key={item.key}
								className="inline-flex h-[30px] max-w-full items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap rounded-control border border-line-strong px-3 text-sm text-ink"
							>
								<span
									aria-hidden="true"
									className="inline-block size-[7px] shrink-0 rounded-full"
									style={{ background: color }}
								/>
								{title}
							</span>
						);
					})}
				</div>
			)}

			<div
				aria-hidden="true"
				className="t-tape-measure"
				onPointerMove={onPointerMove}
				onPointerLeave={onPointerLeave}
			>
				<div className="t-tape-times">
					{blocks.map((b, i) =>
						showLabel[i] ? (
							<span key={b.key} style={{ left: `${at(b.startMin)}%` }}>
								{b.time}
							</span>
						) : null,
					)}
				</div>
				<div className="t-track">
					{blocks.map((b, i) => (
						<div
							key={b.key}
							className="t-blk"
							data-kind={b.kind}
							style={{
								left: `${at(b.startMin)}%`,
								// Minus 2px, so back-to-back meetings stay two blocks
								// instead of merging into one long one. min-width keeps a
								// 15-minute block from vanishing into that gutter.
								width:
									b.kind === "event"
										? `calc(${at(b.startMin + b.durationMin) - at(b.startMin)}% - 2px)`
										: 0,
								// Only a clash sets a row. One row is left to the stylesheet, so
								// the ordinary block still fills the track to the pixel; the 1px
								// insets below exist to part two rows, not to shrink one.
								...(b.lanes > 1 && {
									top: `calc(${(b.lane * 100) / b.lanes}% + ${b.lane === 0 ? 0 : 1}px)`,
									height: `calc(${100 / b.lanes}% - ${b.lane === 0 || b.lane === b.lanes - 1 ? 1 : 2}px)`,
								}),
								[b.kind === "event" ? "background" : "color"]: b.color,
								// Clock order, so the day assembles left to right.
								animationDelay: `${0.02 + i * 0.05}s`,
							}}
						/>
					))}
					{nowAt !== null && <div className="t-now" style={{ left: `${nowAt}%` }} />}
					{hover !== null && <div className="t-hover" style={{ left: `${hover.at}%` }} />}
				</div>
				<div className="t-ticks">
					{ticks.map((h, i) => {
						const isEnd = i === ticks.length - 1;
						// Two ticks give way, and neither costs anything: the ruler is
						// orientation, not data. The now-label wins because it is the
						// only reading on the ruler that changes — 17:38 printed over
						// 18:00 is worse than an hour going unmarked. The closing hour
						// wins over its neighbour for the same reason: it is the one
						// that says where the day stops.
						if (!isEnd && nowAt !== null && pxGap(at(h * 60), nowAt) < NOW_CLEARANCE_PX)
							return null;
						if (!isEnd && pxGap(at(h * 60), 100) < END_CLEARANCE_PX) return null;
						// The hover reading now sits on this same row, so it displaces a
						// ruled hour exactly as the now-label does — including the closing
						// one, which is the only reading the scrub can reach at the edge.
						if (
							hover !== null &&
							pxGap(isEnd ? 100 : at(h * 60), hover.at) <
								(isEnd ? END_CLEARANCE_PX : NOW_CLEARANCE_PX)
						)
							return null;
						// The last tick anchors to the right edge instead of its own
						// position, so the closing hour is never half off the page.
						// `left` is omitted rather than overridden: an inline left
						// would win over the stylesheet and stretch the box.
						const edge = i === 0 ? "start" : isEnd ? "end" : undefined;
						return (
							<span
								key={h}
								style={edge === "end" ? undefined : { left: `${at(h * 60)}%` }}
								data-edge={edge}
								data-keep={i === 0 || edge === "end" || h === PHONE_LANDMARK_H}
							>
								{formatHour(h)}
							</span>
						);
					})}
					{nowAt !== null &&
						nowLabel !== null &&
						!(hover !== null && pxGap(nowAt, hover.at) < NOW_CLEARANCE_PX) && (
							<span data-now="" data-keep="true" style={{ left: `${nowAt}%` }}>
								{nowLabel}
							</span>
						)}
					{hover !== null && (
						// Centred like any tick, except at the two ends, where it anchors
						// the way 06:00 and the closing hour do — a scrub at the very edge
						// must not hang half off the page.
						<span
							data-hover=""
							data-keep="true"
							data-edge={hoverEdge}
							style={hoverEdge === "end" ? undefined : { left: `${hover.at}%` }}
						>
							{hover.label}
						</span>
					)}
				</div>
			</div>
		</section>
	);
}
