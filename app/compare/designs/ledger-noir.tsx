import type { CompareDay } from "../mock";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap");

.dz-lnoir {
	--canvas: #0f151d;
	--well: #151d27;
	--well-2: #182130;
	--hairline: #243040;
	--hairline-soft: #1c2733;
	--ink-1: #eef2f6;
	--ink-2: #b9c4d0;
	--ink-3: #7c8b9c;
	--amber: #e8a23d;
	--green: #4fd18b;
	--blue: #4fa3f7;

	min-height: 100%;
	background: var(--canvas);
	color: var(--ink-1);
	font-family: "IBM Plex Sans", system-ui, sans-serif;
	line-height: 1.4;
	padding: 20px 16px 64px;
	container-type: inline-size;
}

.dz-lnoir * {
	box-sizing: border-box;
}

.dz-lnoir .mono {
	font-family: "IBM Plex Mono", ui-monospace, monospace;
	font-variant-numeric: tabular-nums;
}

.dz-lnoir a {
	color: inherit;
	text-decoration: none;
}

.dz-lnoir a:focus-visible,
.dz-lnoir button:focus-visible {
	outline: 2px solid var(--blue);
	outline-offset: 2px;
}

.dz-lnoir button {
	font-family: inherit;
	background: none;
	border: none;
	color: inherit;
	cursor: pointer;
}

.dz-lnoir .label {
	font-family: "IBM Plex Mono", monospace;
	font-size: 10.5px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--ink-3);
}

.dz-lnoir .shell {
	max-width: 1180px;
	margin: 0 auto;
}

.dz-lnoir .section {
	margin-top: 64px;
}

.dz-lnoir .section:first-child {
	margin-top: 0;
}

.dz-lnoir .section-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	border-bottom: 1px solid var(--hairline);
	padding-bottom: 10px;
	margin-bottom: 16px;
}

.dz-lnoir .section-head h2 {
	font-family: "IBM Plex Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.16em;
	text-transform: uppercase;
	color: var(--ink-2);
	margin: 0;
}

/* Header */
.dz-lnoir header.top {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px 16px;
	border-bottom: 1px solid var(--hairline);
	padding-bottom: 20px;
}

.dz-lnoir header.top .dateline {
	font-size: 22px;
	font-weight: 600;
	letter-spacing: -0.01em;
}

.dz-lnoir header.top .meta-row {
	display: flex;
	flex-wrap: wrap;
	gap: 4px 14px;
	font-family: "IBM Plex Mono", monospace;
	font-size: 11.5px;
	color: var(--ink-3);
}

.dz-lnoir header.top .meta-row .unread {
	color: var(--amber);
}

.dz-lnoir header.top .ask-link {
	font-family: "IBM Plex Mono", monospace;
	font-size: 11.5px;
	letter-spacing: 0.06em;
	color: var(--blue);
	border-bottom: 1px solid var(--blue);
	padding-bottom: 2px;
}

/* Anchor line */
.dz-lnoir .anchor {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 12px;
	margin-top: 20px;
}

@container (min-width: 700px) {
	.dz-lnoir .anchor {
		grid-template-columns: repeat(4, 1fr);
	}
}

.dz-lnoir .anchor-item {
	border-left: 1px solid var(--hairline);
	padding-left: 12px;
}

.dz-lnoir .anchor-item .big {
	font-family: "IBM Plex Mono", monospace;
	font-size: 20px;
	font-weight: 600;
	white-space: nowrap;
}

.dz-lnoir .anchor-item .cap {
	display: block;
	margin-top: 3px;
}

.dz-lnoir .anchor-item.attn .big {
	color: var(--amber);
}

/* Cadence */
.dz-lnoir .cadence-row {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 1px;
	background: var(--hairline);
	border: 1px solid var(--hairline);
}

@container (min-width: 700px) {
	.dz-lnoir .cadence-row {
		grid-template-columns: repeat(5, 1fr);
	}
}

.dz-lnoir .cadence-cell {
	background: var(--well);
	padding: 14px 12px;
	display: block;
}

.dz-lnoir .cadence-cell .big {
	font-family: "IBM Plex Mono", monospace;
	font-size: 26px;
	font-weight: 600;
	display: block;
	white-space: nowrap;
}

.dz-lnoir .cadence-cell.slip .big {
	color: var(--amber);
}

.dz-lnoir .cadence-cell .label {
	margin-top: 6px;
	display: block;
}

/* Alerts */
.dz-lnoir .alerts {
	display: flex;
	flex-direction: column;
	border-top: 1px solid var(--hairline);
}

.dz-lnoir .alert-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 4px;
	border-bottom: 1px solid var(--hairline);
	gap: 12px;
}

.dz-lnoir .alert-row .count {
	font-family: "IBM Plex Mono", monospace;
	font-weight: 600;
	color: var(--amber);
	min-width: 2ch;
	text-align: right;
}

.dz-lnoir .alert-row .txt {
	flex: 1;
	font-size: 14px;
	color: var(--ink-2);
}

.dz-lnoir .alert-row .go {
	font-family: "IBM Plex Mono", monospace;
	font-size: 11px;
	color: var(--ink-3);
}

/* Day tape */
.dz-lnoir .tape {
	position: relative;
	margin-top: 8px;
	padding-top: 48px;
	padding-bottom: 34px;
}

.dz-lnoir .tape-axis {
	position: relative;
	height: 2px;
	background: var(--hairline);
}

.dz-lnoir .tape-tick {
	position: absolute;
	top: -3px;
	width: 1px;
	height: 8px;
	background: var(--hairline);
}

.dz-lnoir .tape-tick-label {
	position: absolute;
	top: 10px;
	transform: translateX(-50%);
	font-family: "IBM Plex Mono", monospace;
	font-size: 9px;
	color: var(--ink-3);
	white-space: nowrap;
}

.dz-lnoir .tape-now {
	position: absolute;
	top: -30px;
	width: 2px;
	height: 40px;
	background: var(--blue);
	transform: translateX(-1px);
}

/* Sits on its own tier above the flag labels so it never collides with the
 * 09:00 flag sitting just left of it. */
.dz-lnoir .tape-now-label {
	position: absolute;
	top: -44px;
	transform: translateX(-50%);
	font-family: "IBM Plex Mono", monospace;
	font-size: 10px;
	font-weight: 600;
	color: var(--blue);
	white-space: nowrap;
}

.dz-lnoir .tape-flag {
	position: absolute;
	width: 1px;
	background: var(--hairline-soft);
}

.dz-lnoir .tape-flag.tier-up {
	bottom: 2px;
	height: 14px;
}

.dz-lnoir .tape-flag.tier-down {
	top: 2px;
	height: 14px;
}

.dz-lnoir .tape-dot {
	position: absolute;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--ink-3);
	transform: translate(-50%, -50%);
}

.dz-lnoir .tape-dot.top3 {
	background: var(--amber);
}

.dz-lnoir .tape-dot.done {
	background: var(--green);
}

.dz-lnoir .tape-flag-label {
	position: absolute;
	transform: translateX(-50%);
	font-family: "IBM Plex Mono", monospace;
	font-size: 9px;
	color: var(--ink-3);
	white-space: nowrap;
}

.dz-lnoir .tape-flag-label.tier-up {
	bottom: 18px;
}

.dz-lnoir .tape-flag-label.tier-down {
	top: 18px;
}

.dz-lnoir .tape-flag-title {
	display: none;
}

@container (min-width: 700px) {
	.dz-lnoir .tape {
		padding-top: 44px;
		padding-bottom: 54px;
	}

	.dz-lnoir .tape-flag-title {
		display: inline;
		color: var(--ink-2);
	}
}

/* Schedule list */
.dz-lnoir .sched-group {
	margin-top: 24px;
}

.dz-lnoir .sched-group .sub-label {
	margin-bottom: 8px;
	display: block;
}

.dz-lnoir .row {
	display: grid;
	grid-template-columns: 52px 1fr auto;
	align-items: start;
	gap: 10px;
	padding: 10px 4px;
	border-bottom: 1px solid var(--hairline-soft);
}

.dz-lnoir .row .time {
	font-family: "IBM Plex Mono", monospace;
	font-size: 12.5px;
	color: var(--ink-3);
	white-space: nowrap;
	padding-top: 1px;
}

.dz-lnoir .row .body .title {
	font-size: 14px;
	color: var(--ink-1);
}

.dz-lnoir .row .body .title.done {
	color: var(--ink-3);
	text-decoration: line-through;
}

.dz-lnoir .row .body .meta {
	display: block;
	font-family: "IBM Plex Mono", monospace;
	font-size: 11px;
	color: var(--ink-3);
	margin-top: 3px;
}

.dz-lnoir .row .body .meta.overdue {
	color: var(--amber);
}

.dz-lnoir .row .flags {
	display: flex;
	gap: 6px;
	align-items: center;
}

.dz-lnoir .chip {
	font-family: "IBM Plex Mono", monospace;
	font-size: 9.5px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	padding: 2px 6px;
	border: 1px solid var(--hairline);
	color: var(--ink-3);
	white-space: nowrap;
}

.dz-lnoir .chip.top3 {
	color: var(--amber);
	border-color: var(--amber);
}

.dz-lnoir .chip.done {
	color: var(--green);
	border-color: var(--green);
}

/* Brief */
.dz-lnoir .brief-row {
	padding: 16px 4px;
	border-bottom: 1px solid var(--hairline);
}

.dz-lnoir .brief-top {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.dz-lnoir .brief-name {
	font-size: 15px;
	font-weight: 600;
}

.dz-lnoir .brief-figure {
	font-family: "IBM Plex Mono", monospace;
	font-size: 20px;
	font-weight: 600;
	white-space: nowrap;
}

.dz-lnoir .brief-figure .unit {
	font-family: "IBM Plex Sans", sans-serif;
	font-size: 11px;
	font-weight: 400;
	color: var(--ink-3);
	margin-left: 6px;
}

.dz-lnoir .brief-figure.over {
	color: var(--amber);
}

.dz-lnoir .meter {
	position: relative;
	height: 4px;
	background: var(--well-2);
	margin-top: 10px;
	border: 1px solid var(--hairline);
}

.dz-lnoir .meter-fill {
	position: relative;
	height: 100%;
	background: var(--ink-3);
}

.dz-lnoir .meter-fill.over {
	background: var(--amber);
}

.dz-lnoir .meter-threshold {
	position: absolute;
	top: -3px;
	width: 1px;
	height: 10px;
	background: var(--ink-2);
}

.dz-lnoir .brief-action {
	margin-top: 10px;
	font-size: 13px;
	color: var(--ink-2);
}

/* Routines */
.dz-lnoir .routines-summary {
	font-family: "IBM Plex Mono", monospace;
	font-size: 13px;
	color: var(--ink-2);
}

.dz-lnoir .routine-bucket {
	margin-top: 18px;
}

.dz-lnoir .routine-bucket .sub-label {
	margin-bottom: 6px;
	display: block;
}

.dz-lnoir .routine-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 9px 4px;
	border-bottom: 1px solid var(--hairline-soft);
}

.dz-lnoir .routine-check {
	width: 14px;
	height: 14px;
	border: 1px solid var(--hairline);
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.dz-lnoir .routine-check.done {
	background: var(--green);
	border-color: var(--green);
}

.dz-lnoir .routine-check.done::after {
	content: "";
	width: 6px;
	height: 6px;
	background: var(--canvas);
}

.dz-lnoir .routine-name {
	flex: 1;
	font-size: 13.5px;
	color: var(--ink-1);
}

.dz-lnoir .routine-row.done .routine-name {
	color: var(--ink-3);
}

.dz-lnoir .routine-meta {
	font-family: "IBM Plex Mono", monospace;
	font-size: 11px;
	color: var(--ink-3);
	white-space: nowrap;
}

/* Projects */
.dz-lnoir .project-row {
	padding: 14px 4px;
	border-bottom: 1px solid var(--hairline);
}

.dz-lnoir .project-top {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 12px;
}

.dz-lnoir .project-name {
	font-size: 14px;
	font-weight: 600;
}

.dz-lnoir .project-pct {
	font-family: "IBM Plex Mono", monospace;
	font-size: 13px;
	color: var(--ink-2);
	white-space: nowrap;
}

.dz-lnoir .project-bar {
	height: 4px;
	background: var(--well-2);
	border: 1px solid var(--hairline);
	margin-top: 9px;
}

.dz-lnoir .project-bar-fill {
	height: 100%;
	background: var(--blue);
}

.dz-lnoir .project-milestone {
	margin-top: 8px;
	font-size: 12.5px;
	color: var(--ink-3);
}

/* Quotes */
.dz-lnoir .quotes {
	display: grid;
	grid-template-columns: 1fr;
	gap: 20px;
}

@container (min-width: 700px) {
	.dz-lnoir .quotes {
		grid-template-columns: 1fr 1fr;
	}
}

.dz-lnoir .quote-card {
	border-left: 2px solid var(--hairline);
	padding-left: 16px;
}

.dz-lnoir .quote-card blockquote {
	margin: 0;
	font-size: 15px;
	font-style: italic;
	color: var(--ink-1);
	line-height: 1.5;
}

.dz-lnoir .quote-card .attrib {
	margin-top: 8px;
	font-family: "IBM Plex Mono", monospace;
	font-size: 11px;
	color: var(--ink-3);
}

.dz-lnoir .quote-actions {
	margin-top: 12px;
	display: flex;
	gap: 12px;
}

.dz-lnoir .quote-actions button {
	font-family: "IBM Plex Mono", monospace;
	font-size: 10.5px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: var(--blue);
	border-bottom: 1px solid var(--blue);
	padding-bottom: 2px;
}

/* Capture */
.dz-lnoir .capture-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.dz-lnoir .capture-chip {
	font-family: "IBM Plex Mono", monospace;
	font-size: 12px;
	letter-spacing: 0.04em;
	padding: 8px 14px;
	border: 1px solid var(--hairline);
	color: var(--ink-2);
}

.dz-lnoir .capture-hint {
	margin-top: 16px;
	font-size: 12.5px;
	color: var(--ink-3);
}

.dz-lnoir .capture-hint .key {
	color: var(--blue);
}

@media (prefers-reduced-motion: reduce) {
	.dz-lnoir * {
		animation: none !important;
		transition: none !important;
	}
}
`;

const TAPE_START_MIN = 6 * 60;
const TAPE_END_MIN = 24 * 60;
const TAPE_TICKS = [6, 9, 12, 15, 18, 21, 24];

function toMinutes(time: string): number {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

function pct(minutes: number): number {
	const clamped = Math.min(Math.max(minutes, TAPE_START_MIN), TAPE_END_MIN);
	return ((clamped - TAPE_START_MIN) / (TAPE_END_MIN - TAPE_START_MIN)) * 100;
}

export function LedgerNoirDesign({ day }: { day: CompareDay }) {
	const nowMinutes = toMinutes(day.nowLabel);
	const timelineFlags = day.schedule.timeline.map((item, i) => ({
		...item,
		tier: i % 2 === 0 ? "tier-up" : "tier-down",
	}));

	return (
		<div className="dz-lnoir">
			<style>{CSS}</style>
			<div className="shell">
				<header className="top">
					<div>
						<div className="dateline">{day.dateline}</div>
						<div className="meta-row">
							<span>{day.weekday}</span>
							<span>ISO wk {day.isoWeek}</span>
							<span>{day.timezone}</span>
							<span className="unread">{day.unreadNotifications} unread</span>
						</div>
					</div>
					<a className="ask-link" href="/ask">
						Ask →
					</a>
				</header>

				<section className="section" aria-label="Anchor summary">
					<div className="anchor">
						<div className="anchor-item">
							<span className="big mono">{day.anchor.eventCount}</span>
							<span className="label cap">events today</span>
						</div>
						<div className="anchor-item">
							<span className="big mono">{day.anchor.nextEvent.time}</span>
							<span className="label cap">{day.anchor.nextEvent.title}</span>
						</div>
						<div className="anchor-item">
							<span className="big mono">{day.anchor.openCount}</span>
							<span className="label cap">open tasks</span>
						</div>
						<div className="anchor-item attn">
							<span className="big mono">{day.anchor.overdueCount}</span>
							<span className="label cap">overdue</span>
						</div>
					</div>
				</section>

				<section className="section" aria-label="Cadence">
					<div className="section-head">
						<h2>Cadence</h2>
					</div>
					<div className="cadence-row">
						{day.cadence.map((c) => (
							<a
								key={c.key}
								href={c.href}
								className={c.slip ? "cadence-cell slip" : "cadence-cell"}
							>
								<span className="big mono">{c.big}</span>
								<span className="label">{c.label}</span>
							</a>
						))}
					</div>
				</section>

				<section className="section" aria-label="Alerts">
					<div className="section-head">
						<h2>Awaiting decision</h2>
					</div>
					<div className="alerts">
						{day.alerts.map((a) => (
							<a key={a.key} href={a.href} className="alert-row">
								<span className="count mono">{a.count}</span>
								<span className="txt">{a.label}</span>
								<span className="go">→</span>
							</a>
						))}
					</div>
				</section>

				<section className="section" aria-label="Day tape">
					<div className="section-head">
						<h2>Day tape</h2>
					</div>
					<div className="tape">
						<div className="tape-axis">
							{TAPE_TICKS.map((h) => (
								<div key={h} className="tape-tick" style={{ left: `${pct(h * 60)}%` }} />
							))}
							{TAPE_TICKS.map((h) => (
								<div
									key={`tl-${h}`}
									className="tape-tick-label"
									style={{ left: `${pct(h * 60)}%` }}
								>
									{String(h).padStart(2, "0")}
									:00
								</div>
							))}
							{timelineFlags.map((item) => {
								const left = pct(toMinutes(item.time));
								const dotClass = item.done
									? "tape-dot done"
									: item.top3
										? "tape-dot top3"
										: "tape-dot";
								return (
									<div key={item.key}>
										<div className={`tape-flag ${item.tier}`} style={{ left: `${left}%` }} />
										<div className={dotClass} style={{ left: `${left}%`, top: 0 }} />
										<div className={`tape-flag-label ${item.tier}`} style={{ left: `${left}%` }}>
											{item.time}
											<span className="tape-flag-title"> · {item.title}</span>
										</div>
									</div>
								);
							})}
							<div className="tape-now" style={{ left: `${pct(nowMinutes)}%` }} />
							<div className="tape-now-label" style={{ left: `${pct(nowMinutes)}%` }}>
								now {day.nowLabel}
							</div>
						</div>
					</div>
				</section>

				<section className="section" aria-label="Day schedule">
					<div className="section-head">
						<h2>Schedule</h2>
					</div>

					<div className="sched-group">
						<span className="label sub-label">All day</span>
						{day.schedule.allDay.map((item) => (
							<div className="row" key={item.key}>
								<span className="time mono">—</span>
								<div className="body">
									<span className={item.done ? "title done" : "title"}>{item.title}</span>
									<span className="meta">{item.meta}</span>
								</div>
								<div className="flags">
									{item.top3 && <span className="chip top3">Top 3</span>}
									{item.done && <span className="chip done">Done</span>}
								</div>
							</div>
						))}
					</div>

					<div className="sched-group">
						<span className="label sub-label">Timeline</span>
						{day.schedule.timeline.map((item) => (
							<div className="row" key={item.key}>
								<span className="time mono">{item.time}</span>
								<div className="body">
									<span className={item.done ? "title done" : "title"}>{item.title}</span>
									<span className="meta">{item.meta}</span>
								</div>
								<div className="flags">
									{item.top3 && <span className="chip top3">Top 3</span>}
									{item.done && <span className="chip done">Done</span>}
								</div>
							</div>
						))}
					</div>

					<div className="sched-group">
						<span className="label sub-label">Open</span>
						{day.schedule.open.map((item) => (
							<div className="row" key={item.key}>
								<span className="time mono">—</span>
								<div className="body">
									<span className={item.done ? "title done" : "title"}>{item.title}</span>
									<span className={item.overdue ? "meta overdue" : "meta"}>{item.meta}</span>
								</div>
								<div className="flags">
									{item.top3 && <span className="chip top3">Top 3</span>}
									{item.done && <span className="chip done">Done</span>}
								</div>
							</div>
						))}
					</div>
				</section>

				<section className="section" aria-label="In brief">
					<div className="section-head">
						<h2>In brief</h2>
					</div>
					{day.brief.map((b) => {
						const over = b.daysSince >= b.thresholdDays;
						const fillPct = Math.min((b.daysSince / (b.thresholdDays * 1.4)) * 100, 100);
						const thresholdPct = Math.min((b.thresholdDays / (b.thresholdDays * 1.4)) * 100, 100);
						return (
							<a className="brief-row" key={b.key} href={b.href}>
								<div className="brief-top">
									<span className="brief-name">{b.name}</span>
									<span className={over ? "brief-figure mono over" : "brief-figure mono"}>
										{b.daysSince}
										<span className="unit">{b.unit}</span>
									</span>
								</div>
								<div className="meter">
									<div
										className={over ? "meter-fill over" : "meter-fill"}
										style={{ width: `${fillPct}%` }}
									/>
									<div className="meter-threshold" style={{ left: `${thresholdPct}%` }} />
								</div>
								<div className="brief-action">{b.nextAction}</div>
							</a>
						);
					})}
				</section>

				<section className="section" aria-label="Routines">
					<div className="section-head">
						<h2>Routines</h2>
						<span className="routines-summary mono">
							{day.routines.done}/{day.routines.total} done
						</span>
					</div>
					{day.routines.buckets.map((bucket) => (
						<div className="routine-bucket" key={bucket.bucket}>
							<span className="label sub-label">{bucket.bucket}</span>
							{bucket.rows.map((r) => (
								<div className={r.done ? "routine-row done" : "routine-row"} key={r.id}>
									<span className={r.done ? "routine-check done" : "routine-check"} />
									<span className="routine-name">{r.name}</span>
									<span className="routine-meta mono">
										{r.time ? `${r.time} · ` : ""}
										{r.streak}d streak
									</span>
								</div>
							))}
						</div>
					))}
				</section>

				<section className="section" aria-label="Projects">
					<div className="section-head">
						<h2>Projects</h2>
					</div>
					{day.projects.map((p) => (
						<div className="project-row" key={p.id}>
							<div className="project-top">
								<span className="project-name">{p.name}</span>
								<span className="project-pct mono">{Math.round(p.progress * 100)}%</span>
							</div>
							<div className="project-bar">
								<div className="project-bar-fill" style={{ width: `${p.progress * 100}%` }} />
							</div>
							<div className="project-milestone">Next: {p.nextMilestone}</div>
						</div>
					))}
				</section>

				<section className="section" aria-label="Quotes">
					<div className="section-head">
						<h2>Quotes</h2>
					</div>
					<div className="quotes">
						<div className="quote-card">
							<span className="label">Resurfaced</span>
							<blockquote>&ldquo;{day.resurfaced.text}&rdquo;</blockquote>
							<div className="attrib">
								{day.resurfaced.author} · {day.resurfaced.reference}
							</div>
							<div className="quote-actions">
								<button type="button">Next</button>
								<button type="button">Reset</button>
							</div>
						</div>
						<div className="quote-card">
							<span className="label">Latest</span>
							<blockquote>&ldquo;{day.latestQuote.text}&rdquo;</blockquote>
							<div className="attrib">
								{day.latestQuote.author} · {day.latestQuote.reference}
							</div>
						</div>
					</div>
				</section>

				<section className="section" aria-label="Capture">
					<div className="section-head">
						<h2>Capture</h2>
					</div>
					<div className="capture-chips">
						{day.capture.map((c) => (
							<span className="capture-chip" key={c}>
								{c}
							</span>
						))}
					</div>
					<div className="capture-hint">
						Hold <span className="key mono">the mic</span> to capture a thought, task, or note.
					</div>
				</section>
			</div>
		</div>
	);
}
