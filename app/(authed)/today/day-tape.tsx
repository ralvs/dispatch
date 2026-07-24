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
	nowMinutes: number,
): { startMin: number; endMin: number; ticks: number[] } {
	const points = [...itemMinutes, nowMinutes].filter((m) => Number.isFinite(m));
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

const TAPE_CSS = `
.dt-tape {
	position: relative;
	padding-top: 64px;
	padding-bottom: 52px;
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
}

.dt-flag-label.tier-up {
	bottom: 18px;
}

.dt-flag-label.tier-down {
	top: 32px;
}

.dt-flag-title {
	display: none;
}

@media (min-width: 48rem) {
	.dt-tape {
		padding-top: 72px;
		/* Two-line flags (title over time) hang lower than the old single line. */
		padding-bottom: 72px;
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
	todayIso,
	nowLabel,
}: {
	timeline: DayScheduleItem[];
	todayIso: string;
	nowLabel: string;
}) {
	const flags = timeline
		.filter((item): item is DayScheduleItem & { time: string } => item.time !== null)
		.map((item, i) => {
			const title = item.kind === "task" ? item.task.title : item.event.title;
			const top3 = item.kind === "task" && isTop3Today(item.task, todayIso);
			const done = item.kind === "task" && item.task.status === "done";
			return {
				key: item.key,
				time: item.time,
				title,
				top3,
				done,
				tier: i % 2 === 0 ? "tier-up" : "tier-down",
			};
		});

	const nowMinutes = toMinutes(nowLabel);
	const { startMin, endMin, ticks } = computeTapeRange(
		flags.map((f) => toMinutes(f.time)),
		nowMinutes,
	);
	const pct = (m: number) => tapePct(m, startMin, endMin);

	return (
		<section aria-label="Day tape" className="mt-14">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Day tape</h2>
			<style>{TAPE_CSS}</style>
			<div className="dt-tape mt-2">
				<div className="dt-axis">
					{ticks.map((h) => (
						<div key={h} className="dt-tick" style={{ left: `${pct(h * 60)}%` }} />
					))}
					{ticks.map((h) => (
						<div key={`l-${h}`} className="dt-tick-label" style={{ left: `${pct(h * 60)}%` }}>
							{formatTickHour(h)}
						</div>
					))}
					{flags.map((item) => {
						const left = pct(toMinutes(item.time));
						const dotClass = item.done
							? "dt-flag-dot is-done"
							: item.top3
								? "dt-flag-dot is-top3"
								: "dt-flag-dot";
						return (
							<div key={item.key}>
								<div className={`dt-flag-stem ${item.tier}`} style={{ left: `${left}%` }} />
								<div className={dotClass} style={{ left: `${left}%` }} />
								<div className={`dt-flag-label ${item.tier}`} style={{ left: `${left}%` }}>
									<span className="dt-flag-title">{item.title}</span>
									<span>
										{item.time}
										{item.top3 && !item.done && <span className="text-warning"> ★</span>}
									</span>
								</div>
							</div>
						);
					})}
					<div className="dt-now" style={{ left: `${pct(nowMinutes)}%` }} />
					<div className="dt-now-label" style={{ left: `${pct(nowMinutes)}%` }}>
						now {nowLabel}
					</div>
				</div>
			</div>
		</section>
	);
}
