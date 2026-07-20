import type { CompareDay } from "../mock";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap");

.dz-flightdeck {
	--ground: #0d131b;
	--panel: #131b25;
	--bezel: #1a2530;
	--bezel-hi: #223040;
	--line: #263544;
	--ink: #d7e2ea;
	--ink-dim: #7f93a3;
	--ink-faint: #566a7a;
	--amber: #f5a623;
	--amber-glow: rgba(245, 166, 35, 0.55);
	--green: #4ade80;
	--green-glow: rgba(74, 222, 128, 0.45);
	--cyan: #5fd3e8;
	--cyan-glow: rgba(95, 211, 232, 0.5);

	min-height: 100%;
	background: var(--ground);
	color: var(--ink);
	font-family: "IBM Plex Sans", sans-serif;
	padding: 20px 16px 72px;
	container-type: inline-size;
}

.dz-flightdeck * {
	box-sizing: border-box;
}

.dz-flightdeck .num {
	font-family: "Chakra Petch", "IBM Plex Mono", monospace;
	font-variant-numeric: tabular-nums;
	letter-spacing: 0.02em;
}

.dz-flightdeck .mono {
	font-family: "IBM Plex Mono", monospace;
	font-variant-numeric: tabular-nums;
}

.dz-flightdeck a {
	color: var(--cyan);
	text-decoration: none;
}
.dz-flightdeck a:hover {
	text-decoration: underline;
}

.dz-flightdeck :focus-visible {
	outline: 2px solid var(--cyan);
	outline-offset: 2px;
	border-radius: 2px;
}

.dz-flightdeck button {
	font-family: inherit;
	cursor: pointer;
}

/* ---- header annunciator strip ---- */
.dz-header {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 18px;
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 14px 18px;
	position: relative;
}

.dz-header .dial {
	color: var(--ink-dim);
	font-size: 0.72rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	white-space: nowrap;
}

.dz-header .dateline {
	font-size: 1.05rem;
	color: var(--ink);
	font-weight: 600;
	white-space: nowrap;
}

.dz-header .spacer {
	flex: 1 1 auto;
}

.dz-header .unread {
	color: var(--amber);
	font-size: 0.78rem;
	white-space: nowrap;
	text-shadow: 0 0 10px var(--amber-glow);
}

.dz-header .ask-link {
	font-size: 0.78rem;
	white-space: nowrap;
	border: 1px solid var(--line);
	border-radius: 4px;
	padding: 4px 10px;
	color: var(--cyan);
}

/* ---- sections ---- */
.dz-flightdeck section {
	margin-top: 64px;
}

.dz-flightdeck section:first-of-type {
	margin-top: 32px;
}

.dz-section-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 16px;
	border-bottom: 1px solid var(--line);
	padding-bottom: 8px;
}

.dz-section-head h2 {
	font-size: 0.78rem;
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: var(--ink-dim);
	margin: 0;
	font-weight: 600;
}

.dz-section-head .tag {
	font-size: 0.72rem;
	color: var(--ink-faint);
}

/* ---- anchor strip ---- */
.dz-anchor {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 12px;
}

@container (min-width: 700px) {
	.dz-anchor {
		grid-template-columns: repeat(4, 1fr);
	}
}

.dz-anchor .cell {
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 12px 14px;
}

.dz-anchor .cell .num {
	display: block;
	font-size: 1.5rem;
	color: var(--cyan);
	text-shadow: 0 0 8px var(--cyan-glow);
}

.dz-anchor .cell.warn .num {
	color: var(--amber);
	text-shadow: 0 0 8px var(--amber-glow);
}

.dz-anchor .cell .lbl {
	display: block;
	font-size: 0.68rem;
	color: var(--ink-dim);
	text-transform: uppercase;
	letter-spacing: 0.06em;
	margin-top: 4px;
	white-space: nowrap;
}

.dz-anchor .cell .next {
	font-size: 0.82rem;
	color: var(--ink);
	margin-top: 2px;
	display: block;
}

/* ---- gauge bank (signature) ---- */
.dz-gauges {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 14px;
	background: var(--panel);
	border: 1px solid var(--bezel-hi);
	border-radius: 8px;
	padding: 24px 16px;
}

@container (min-width: 700px) {
	.dz-gauges {
		grid-template-columns: repeat(5, 1fr);
		padding: 28px 20px;
	}
}

.dz-gauge {
	background: var(--bezel);
	border: 1px solid var(--line);
	border-radius: 8px;
	padding: 14px 8px 12px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	text-align: center;
	min-width: 0;
}

.dz-gauge .readout {
	font-size: 1.3rem;
	color: var(--cyan);
	text-shadow: 0 0 8px var(--cyan-glow);
}

.dz-gauge.slip .readout {
	color: var(--amber);
	text-shadow: 0 0 8px var(--amber-glow);
}

.dz-gauge .glabel {
	font-size: 0.66rem;
	color: var(--ink-dim);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	white-space: nowrap;
}

.dz-gauge a {
	color: inherit;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	width: 100%;
}

/* ---- alerts (lamps) ---- */
.dz-alerts {
	display: flex;
	flex-wrap: wrap;
	gap: 12px;
}

.dz-lamp {
	display: flex;
	align-items: center;
	gap: 10px;
	background: var(--panel);
	border: 1px solid var(--amber);
	border-radius: 6px;
	padding: 10px 14px;
	flex: 1 1 200px;
}

.dz-lamp .dot {
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: var(--amber);
	box-shadow: 0 0 8px 2px var(--amber-glow);
	flex: none;
}

.dz-lamp .count {
	color: var(--amber);
	font-size: 1rem;
	text-shadow: 0 0 6px var(--amber-glow);
}

.dz-lamp .lbl {
	font-size: 0.78rem;
	color: var(--ink);
	white-space: nowrap;
}

/* ---- schedule ---- */
.dz-timeline-strip {
	position: relative;
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 20px 12px 14px;
	margin-bottom: 20px;
	overflow-x: auto;
}

.dz-timeline-track {
	position: relative;
	display: flex;
	min-width: 560px;
	height: 96px;
	border-top: 1px solid var(--line);
}

.dz-timeline-track .now-mark {
	position: absolute;
	top: -20px;
	left: var(--now-pct, 20%);
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}

.dz-timeline-track .now-mark .now-line {
	width: 2px;
	height: 112px;
	background: var(--cyan);
	box-shadow: 0 0 6px var(--cyan-glow);
}

.dz-timeline-track .now-mark .now-lbl {
	font-size: 0.68rem;
	color: var(--cyan);
	white-space: nowrap;
}

.dz-timeline-track .tick {
	position: absolute;
	top: 30px;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	width: 100px;
}

.dz-timeline-track .tick .stem {
	width: 1px;
	height: 8px;
	background: var(--ink-faint);
}

.dz-timeline-track .tick .time {
	font-size: 0.66rem;
	color: var(--ink-dim);
}

/* Titles alternate tiers above/below the time row so adjacent entries
 * (09:00 / 10:30) never share a label line. */
.dz-timeline-track .tick .title {
	position: absolute;
	bottom: calc(100% + 2px);
	left: 50%;
	transform: translateX(-50%);
	font-size: 0.68rem;
	color: var(--ink);
	text-align: center;
	white-space: nowrap;
	max-width: 96px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.dz-timeline-track .tick.tier2 .title {
	bottom: auto;
	top: calc(100% + 2px);
}

.dz-timeline-track .tick.top3 .title {
	color: var(--amber);
}

.dz-timeline-track .tick.done .title {
	color: var(--green);
	text-decoration: line-through;
}

.dz-day-rows {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.dz-row {
	display: flex;
	align-items: center;
	gap: 10px;
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 9px 12px;
}

.dz-row .kind {
	font-size: 0.62rem;
	text-transform: uppercase;
	color: var(--ink-faint);
	width: 42px;
	flex: none;
	white-space: nowrap;
}

.dz-row .time {
	font-size: 0.78rem;
	color: var(--cyan);
	width: 44px;
	flex: none;
	white-space: nowrap;
}

.dz-row .title {
	flex: 1 1 auto;
	font-size: 0.86rem;
	color: var(--ink);
	min-width: 0;
}

.dz-row.done .title {
	color: var(--ink-faint);
	text-decoration: line-through;
}

.dz-row.top3 .title::before {
	content: "\\25B2 ";
	color: var(--amber);
	font-size: 0.6rem;
}

.dz-row .meta {
	font-size: 0.72rem;
	color: var(--ink-dim);
	white-space: nowrap;
}

.dz-row.overdue .meta {
	color: var(--amber);
}

.dz-subhead {
	font-size: 0.68rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--ink-faint);
	margin: 14px 0 6px;
}

/* ---- brief ---- */
.dz-brief-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 14px;
}

@container (min-width: 700px) {
	.dz-brief-grid {
		grid-template-columns: repeat(3, 1fr);
	}
}

.dz-brief-card {
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 14px 16px;
}

.dz-brief-card .name {
	font-size: 0.85rem;
	color: var(--ink);
	font-weight: 600;
	margin: 0 0 6px;
}

.dz-brief-card .days {
	font-size: 1.15rem;
	color: var(--green);
	text-shadow: 0 0 6px var(--green-glow);
}

.dz-brief-card.over .days {
	color: var(--amber);
	text-shadow: 0 0 6px var(--amber-glow);
}

.dz-brief-card .unit {
	font-size: 0.68rem;
	color: var(--ink-dim);
	margin-left: 6px;
}

.dz-meter {
	position: relative;
	height: 6px;
	border-radius: 3px;
	background: var(--bezel);
	margin: 8px 0 10px;
	overflow: hidden;
}

.dz-meter .fill {
	position: absolute;
	top: 0;
	left: 0;
	height: 100%;
	background: var(--green);
}

.dz-brief-card.over .dz-meter .fill {
	background: var(--amber);
}

.dz-brief-card .next {
	font-size: 0.78rem;
	color: var(--ink-dim);
	line-height: 1.4;
}

/* ---- routines ---- */
.dz-routine-summary {
	font-size: 0.82rem;
	color: var(--ink-dim);
	margin-bottom: 12px;
}

.dz-routine-summary .num {
	color: var(--green);
	font-size: 1rem;
	text-shadow: 0 0 6px var(--green-glow);
}

.dz-bucket-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 18px;
}

@container (min-width: 700px) {
	.dz-bucket-grid {
		grid-template-columns: repeat(3, 1fr);
	}
}

.dz-bucket h3 {
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: var(--ink-faint);
	margin: 0 0 8px;
}

.dz-bucket ul {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.dz-bucket li {
	display: flex;
	align-items: center;
	gap: 8px;
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 8px 10px;
}

.dz-bucket .check {
	width: 15px;
	height: 15px;
	flex: none;
	border-radius: 3px;
	border: 1px solid var(--ink-faint);
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
}

.dz-bucket li.done .check {
	border-color: var(--green);
	background: var(--green);
	box-shadow: 0 0 6px var(--green-glow);
}

.dz-bucket .rname {
	flex: 1 1 auto;
	font-size: 0.82rem;
	color: var(--ink);
	min-width: 0;
}

.dz-bucket li.done .rname {
	color: var(--ink-faint);
	text-decoration: line-through;
}

.dz-bucket .streak {
	font-size: 0.68rem;
	color: var(--amber);
	white-space: nowrap;
}

/* ---- projects ---- */
.dz-projects {
	display: grid;
	grid-template-columns: 1fr;
	gap: 12px;
}

@container (min-width: 700px) {
	.dz-projects {
		grid-template-columns: repeat(3, 1fr);
	}
}

.dz-project {
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 6px;
	padding: 14px 16px;
	display: flex;
	gap: 14px;
	align-items: center;
}

.dz-project .arc-wrap {
	flex: none;
}

.dz-project .info {
	min-width: 0;
	flex: 1 1 auto;
}

.dz-project .pname {
	font-size: 0.85rem;
	color: var(--ink);
	font-weight: 600;
	margin: 0 0 4px;
}

.dz-project .pct {
	font-size: 0.9rem;
	color: var(--cyan);
	text-shadow: 0 0 6px var(--cyan-glow);
}

.dz-project .milestone {
	font-size: 0.74rem;
	color: var(--ink-dim);
	margin-top: 4px;
}

/* ---- quotes ---- */
.dz-quotes {
	display: grid;
	grid-template-columns: 1fr;
	gap: 20px;
}

@container (min-width: 700px) {
	.dz-quotes {
		grid-template-columns: 1fr 1fr;
	}
}

.dz-quote-card {
	padding: 4px 0 4px 16px;
	border-left: 2px solid var(--line);
}

.dz-quote-card blockquote {
	margin: 0 0 8px;
	font-family: "IBM Plex Sans", sans-serif;
	font-style: italic;
	font-size: 0.95rem;
	color: var(--ink);
	line-height: 1.5;
}

.dz-quote-card cite {
	font-style: normal;
	font-size: 0.76rem;
	color: var(--ink-dim);
	display: block;
}

.dz-quote-actions {
	margin-top: 10px;
	display: flex;
	gap: 8px;
}

.dz-quote-actions button {
	background: transparent;
	border: 1px solid var(--line);
	color: var(--ink-dim);
	border-radius: 4px;
	padding: 4px 10px;
	font-size: 0.72rem;
}

/* ---- capture ---- */
.dz-capture {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
}

.dz-chip {
	background: var(--panel);
	border: 1px solid var(--line);
	border-radius: 999px;
	padding: 6px 14px;
	font-size: 0.78rem;
	color: var(--ink);
}

.dz-mic-hint {
	font-size: 0.74rem;
	color: var(--ink-faint);
	white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
	.dz-flightdeck * {
		animation: none !important;
		transition: none !important;
	}
}
`;

function polarToXy(cx: number, cy: number, r: number, angleDeg: number) {
	const rad = ((angleDeg - 90) * Math.PI) / 180;
	return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
	const start = polarToXy(cx, cy, r, endDeg);
	const end = polarToXy(cx, cy, r, startDeg);
	const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
	return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// Sweeps 270deg (from -135 to +135) proportional to `frac` (0..1).
function GaugeArc({ frac, slip, size = 74 }: { frac: number; slip: boolean; size?: number }) {
	const cx = size / 2;
	const cy = size / 2;
	const r = size / 2 - 8;
	const startDeg = -135;
	const endDeg = 135;
	const valueDeg = startDeg + (endDeg - startDeg) * Math.min(Math.max(frac, 0), 1);
	const color = slip ? "var(--amber)" : "var(--cyan)";
	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
			<title>gauge</title>
			<path
				d={arcPath(cx, cy, r, startDeg, endDeg)}
				fill="none"
				stroke="var(--bezel-hi)"
				strokeWidth={4}
				strokeLinecap="round"
			/>
			<path
				d={arcPath(cx, cy, r, startDeg, valueDeg)}
				fill="none"
				stroke={color}
				strokeWidth={4}
				strokeLinecap="round"
			/>
			{Array.from({ length: 7 }).map((_, i) => {
				const deg = startDeg + ((endDeg - startDeg) / 6) * i;
				const p1 = polarToXy(cx, cy, r + 5, deg);
				const p2 = polarToXy(cx, cy, r + 1, deg);
				return (
					<line
						key={`tick-${deg}`}
						x1={p1.x}
						y1={p1.y}
						x2={p2.x}
						y2={p2.y}
						stroke="var(--ink-faint)"
						strokeWidth={1}
					/>
				);
			})}
		</svg>
	);
}

function ProjectArc({ progress }: { progress: number }) {
	const size = 52;
	const cx = size / 2;
	const cy = size / 2;
	const r = size / 2 - 6;
	const startDeg = -135;
	const endDeg = 135;
	const valueDeg = startDeg + (endDeg - startDeg) * Math.min(Math.max(progress, 0), 1);
	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
			<title>progress</title>
			<path
				d={arcPath(cx, cy, r, startDeg, endDeg)}
				fill="none"
				stroke="var(--bezel-hi)"
				strokeWidth={4}
				strokeLinecap="round"
			/>
			<path
				d={arcPath(cx, cy, r, startDeg, valueDeg)}
				fill="none"
				stroke="var(--cyan)"
				strokeWidth={4}
				strokeLinecap="round"
			/>
		</svg>
	);
}

function timeToMinutes(time: string) {
	const [h, m] = time.split(":").map(Number);
	return h * 60 + m;
}

export function FlightdeckDesign({ day }: { day: CompareDay }) {
	const dayStart = 6 * 60;
	const dayEnd = 24 * 60;
	const span = dayEnd - dayStart;
	const nowMinutes = timeToMinutes(day.nowLabel);
	const nowPct = `${((nowMinutes - dayStart) / span) * 100}%`;

	return (
		<div className="dz-flightdeck">
			<style>{CSS}</style>

			<header className="dz-header">
				<span className="dial">{day.timezone}</span>
				<span className="dateline">{day.dateline}</span>
				<span className="dial">
					{day.weekday} · ISO week {day.isoWeek}
				</span>
				<span className="spacer" />
				<span className="unread">{day.unreadNotifications} unread</span>
				<a className="ask-link" href="/chat">
					Ask →
				</a>
			</header>

			<section aria-labelledby="anchor-head">
				<div className="dz-section-head">
					<h2 id="anchor-head">Anchor</h2>
					<span className="tag">now {day.nowLabel}</span>
				</div>
				<div className="dz-anchor">
					<div className="cell">
						<span className="num mono">{day.anchor.eventCount}</span>
						<span className="lbl">events today</span>
					</div>
					<div className="cell">
						<span className="next mono">{day.anchor.nextEvent.time}</span>
						<span className="lbl">{day.anchor.nextEvent.title}</span>
					</div>
					<div className="cell">
						<span className="num mono">{day.anchor.openCount}</span>
						<span className="lbl">open tasks</span>
					</div>
					<div className="cell warn">
						<span className="num mono">{day.anchor.overdueCount}</span>
						<span className="lbl">overdue</span>
					</div>
				</div>
			</section>

			<section aria-labelledby="cadence-head">
				<div className="dz-section-head">
					<h2 id="cadence-head">Instrument bank</h2>
					<span className="tag">cadence</span>
				</div>
				<div className="dz-gauges">
					{day.cadence.map((c) => {
						const isFraction = c.big.includes("/");
						let frac = 0.5;
						if (isFraction) {
							const [a, b] = c.big.split("/").map(Number);
							frac = b > 0 ? a / b : 0;
						} else {
							const n = Number.parseInt(c.big, 10);
							frac = Number.isNaN(n) ? 0.5 : Math.min(n / 20, 1);
						}
						return (
							<div key={c.key} className={`dz-gauge${c.slip ? " slip" : ""}`}>
								<a href={c.href}>
									<GaugeArc frac={frac} slip={c.slip} />
									<span
										className="readout num"
										style={{ marginTop: -50 }}
										role="img"
										aria-label={`${c.label}: ${c.big}`}
									>
										{c.big}
									</span>
									<span className="glabel" style={{ marginTop: 12 }}>
										{c.label}
									</span>
								</a>
							</div>
						);
					})}
				</div>
			</section>

			<section aria-labelledby="alerts-head">
				<div className="dz-section-head">
					<h2 id="alerts-head">Annunciators</h2>
					<span className="tag">needs attention</span>
				</div>
				<div className="dz-alerts">
					{day.alerts.map((a) => (
						<a key={a.key} className="dz-lamp" href={a.href}>
							<span className="dot" aria-hidden="true" />
							<span className="count num">{a.count}</span>
							<span className="lbl">{a.label}</span>
						</a>
					))}
				</div>
			</section>

			<section aria-labelledby="schedule-head">
				<div className="dz-section-head">
					<h2 id="schedule-head">Day schedule</h2>
					<span className="tag">now {day.nowLabel}</span>
				</div>

				<div className="dz-timeline-strip">
					<div className="dz-timeline-track" style={{ ["--now-pct" as string]: nowPct }}>
						<div className="now-mark">
							<span className="now-lbl mono">{day.nowLabel}</span>
							<span className="now-line" />
						</div>
						{day.schedule.timeline.map((item, i) => {
							const pct = ((timeToMinutes(item.time) - dayStart) / span) * 100;
							return (
								<div
									key={item.key}
									className={`tick${i % 2 === 1 ? " tier2" : ""}${item.top3 ? " top3" : ""}${item.done ? " done" : ""}`}
									style={{ left: `${pct}%` }}
								>
									<span className="title">{item.title}</span>
									<span className="stem" />
									<span className="time mono">{item.time}</span>
								</div>
							);
						})}
					</div>
				</div>

				{day.schedule.allDay.length > 0 && (
					<>
						<p className="dz-subhead">All day</p>
						<ul className="dz-day-rows">
							{day.schedule.allDay.map((item) => (
								<li
									key={item.key}
									className={`dz-row${item.top3 ? " top3" : ""}${item.done ? " done" : ""}`}
								>
									<span className="kind">{item.kind}</span>
									<span className="title">{item.title}</span>
									<span className="meta">{item.meta}</span>
								</li>
							))}
						</ul>
					</>
				)}

				<p className="dz-subhead">Open</p>
				<ul className="dz-day-rows">
					{day.schedule.open.map((item) => (
						<li
							key={item.key}
							className={`dz-row${item.top3 ? " top3" : ""}${item.done ? " done" : ""}${
								item.overdue ? " overdue" : ""
							}`}
						>
							<span className="kind">task</span>
							<span className="title">{item.title}</span>
							<span className="meta">{item.meta}</span>
						</li>
					))}
				</ul>
			</section>

			<section aria-labelledby="brief-head">
				<div className="dz-section-head">
					<h2 id="brief-head">In brief</h2>
					<span className="tag">domains</span>
				</div>
				<div className="dz-brief-grid">
					{day.brief.map((b) => {
						const frac = Math.min(b.daysSince / b.thresholdDays, 1.4) / 1.4;
						return (
							<a key={b.key} className={`dz-brief-card${b.slipping ? " over" : ""}`} href={b.href}>
								<h3 className="name">{b.name}</h3>
								<span
									role="img"
									aria-label={`${b.daysSince} ${b.unit}, threshold ${b.thresholdDays}`}
								>
									<span className="days num">{b.daysSince}</span>
									<span className="unit">{b.unit}</span>
								</span>
								<div className="dz-meter">
									<span className="fill" style={{ width: `${Math.round(frac * 100)}%` }} />
								</div>
								<p className="next">{b.nextAction}</p>
							</a>
						);
					})}
				</div>
			</section>

			<section aria-labelledby="routines-head">
				<div className="dz-section-head">
					<h2 id="routines-head">Routines</h2>
					<span className="tag">buckets</span>
				</div>
				<p className="dz-routine-summary">
					<span className="num">{day.routines.done}</span> of{" "}
					<span className="num">{day.routines.total}</span> done today
				</p>
				<div className="dz-bucket-grid">
					{day.routines.buckets.map((bucket) => (
						<div key={bucket.bucket} className="dz-bucket">
							<h3>{bucket.bucket}</h3>
							<ul>
								{bucket.rows.map((r) => (
									<li key={r.id} className={r.done ? "done" : ""}>
										<button
											type="button"
											className="check"
											aria-pressed={r.done}
											aria-label={`${r.name}, ${r.done ? "done" : "not done"}`}
										>
											{r.done ? "✓" : ""}
										</button>
										<span className="rname">
											{r.name}
											{r.time ? ` · ${r.time}` : ""}
										</span>
										<span className="streak num">{r.streak}d</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>

			<section aria-labelledby="projects-head">
				<div className="dz-section-head">
					<h2 id="projects-head">Projects</h2>
					<span className="tag">progress</span>
				</div>
				<div className="dz-projects">
					{day.projects.map((p) => (
						<div key={p.id} className="dz-project">
							<div className="arc-wrap">
								<div role="img" aria-label={`${p.name} progress ${Math.round(p.progress * 100)}%`}>
									<ProjectArc progress={p.progress} />
								</div>
							</div>
							<div className="info">
								<h3 className="pname">{p.name}</h3>
								<span className="pct num">{Math.round(p.progress * 100)}%</span>
								<p className="milestone">Next: {p.nextMilestone}</p>
							</div>
						</div>
					))}
				</div>
			</section>

			<section aria-labelledby="quotes-head">
				<div className="dz-section-head">
					<h2 id="quotes-head">Quotes</h2>
					<span className="tag">resurfaced</span>
				</div>
				<div className="dz-quotes">
					<div className="dz-quote-card">
						<blockquote>{day.resurfaced.text}</blockquote>
						<cite>
							{day.resurfaced.author} — {day.resurfaced.reference}
						</cite>
						<div className="dz-quote-actions">
							<button type="button">Next</button>
							<button type="button">Reset</button>
						</div>
					</div>
					<div className="dz-quote-card">
						<blockquote>{day.latestQuote.text}</blockquote>
						<cite>
							{day.latestQuote.author} — {day.latestQuote.reference}
						</cite>
					</div>
				</div>
			</section>

			<section aria-labelledby="capture-head">
				<div className="dz-section-head">
					<h2 id="capture-head">Capture</h2>
					<span className="tag">recent</span>
				</div>
				<div className="dz-capture">
					{day.capture.map((c) => (
						<span key={c} className="dz-chip">
							{c}
						</span>
					))}
					<span className="dz-mic-hint">Hold the mic to capture</span>
				</div>
			</section>
		</div>
	);
}
