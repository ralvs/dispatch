import type { DayScheduleItem } from "@/lib/services/briefing";
import { isTop3Today } from "@/lib/task-predicates";

const TAPE_START_MIN = 6 * 60;
const TAPE_END_MIN = 24 * 60;
const TAPE_TICKS = [6, 9, 12, 15, 18, 21, 24];

function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

function tapePct(minutes: number): number {
	const clamped = Math.min(Math.max(minutes, TAPE_START_MIN), TAPE_END_MIN);
	return ((clamped - TAPE_START_MIN) / (TAPE_END_MIN - TAPE_START_MIN)) * 100;
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
	background: var(--bg);
	padding: 0 3px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
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
		padding-top: 64px;
		padding-bottom: 58px;
	}

	.dt-flag-title {
		display: inline;
		color: var(--ink-2);
	}

	.dt-flag-label {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}
`;

/** A horizontal 06:00–24:00 ruler for the day's timed events and tasks. */
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

	if (flags.length === 0) return null;

	const nowMinutes = toMinutes(nowLabel);

	return (
		<section aria-label="Day tape" className="mt-14">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Day tape</h2>
			<style>{TAPE_CSS}</style>
			<div className="dt-tape mt-2">
				<div className="dt-axis">
					{TAPE_TICKS.map((h) => (
						<div key={h} className="dt-tick" style={{ left: `${tapePct(h * 60)}%` }} />
					))}
					{TAPE_TICKS.map((h) => (
						<div key={`l-${h}`} className="dt-tick-label" style={{ left: `${tapePct(h * 60)}%` }}>
							{String(h).padStart(2, "0")}:00
						</div>
					))}
					{flags.map((item) => {
						const left = tapePct(toMinutes(item.time));
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
									{item.time}
									{item.top3 && !item.done && <span className="text-warning"> ★</span>}
									<span className="dt-flag-title"> · {item.title}</span>
								</div>
							</div>
						);
					})}
					<div className="dt-now" style={{ left: `${tapePct(nowMinutes)}%` }} />
					<div className="dt-now-label" style={{ left: `${tapePct(nowMinutes)}%` }}>
						now {nowLabel}
					</div>
				</div>
			</div>
		</section>
	);
}
