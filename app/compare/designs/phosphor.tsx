import type { CompareDay } from "../mock";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap");

.dz-phosphor {
	--bg: #12181f;
	--bg-raised: #161d26;
	--ink: #d7dde3;
	--ink-dim: #8993a1;
	--ink-faint: #5b6472;
	--line: #26303c;
	--amber: #e3a13c;
	--green: #6fae6f;
	--grey: #5b6472;

	min-height: 100%;
	background: var(--bg);
	color: var(--ink);
	font-family: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
	font-size: 14px;
	line-height: 1.65;
	-webkit-font-smoothing: antialiased;
}

.dz-phosphor * {
	box-sizing: border-box;
}

.dz-phosphor a {
	color: inherit;
	text-decoration: none;
}

.dz-phosphor a:hover {
	color: var(--amber);
}

.dz-phosphor :focus-visible {
	outline: 2px solid var(--amber);
	outline-offset: 2px;
}

.dz-phosphor .ph-status {
	position: sticky;
	top: 0;
	z-index: 5;
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 0 1.25em;
	padding: 14px 20px;
	background: rgba(18, 24, 31, 0.92);
	backdrop-filter: blur(6px);
	border-bottom: 1px solid var(--line);
	font-size: 12px;
	color: var(--ink-dim);
	white-space: nowrap;
}

.dz-phosphor .ph-status strong {
	color: var(--ink);
	font-weight: 500;
}

.dz-phosphor .ph-status .ph-unread {
	color: var(--amber);
}

.dz-phosphor .ph-status .ph-ask {
	margin-left: auto;
}

.dz-phosphor .ph-main {
	max-width: 640px;
	margin: 0 auto;
	padding: 48px 20px 96px;
}

.dz-phosphor .ph-section {
	margin-top: 64px;
}

.dz-phosphor .ph-section:first-child {
	margin-top: 0;
}

.dz-phosphor .ph-heading {
	display: flex;
	align-items: baseline;
	gap: 0.6em;
	margin: 0 0 20px;
	font-size: 12px;
	font-weight: 500;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: var(--ink-faint);
}

.dz-phosphor .ph-heading .ph-count {
	color: var(--ink-dim);
	letter-spacing: normal;
	text-transform: none;
}

.dz-phosphor .ph-rule {
	border: none;
	border-top: 1px solid var(--line);
	margin: 64px 0 0;
}

/* Anchor */
.dz-phosphor .ph-anchor {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.dz-phosphor .ph-anchor .ph-next {
	font-size: 28px;
	font-weight: 300;
	color: var(--ink);
}

.dz-phosphor .ph-anchor .ph-next .ph-time {
	color: var(--amber);
	font-weight: 500;
}

.dz-phosphor .ph-anchor .ph-sub {
	color: var(--ink-dim);
	font-size: 13px;
}

/* Cadence */
.dz-phosphor .ph-cadence {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 28px 20px;
	list-style: none;
	margin: 0;
	padding: 0;
}

.dz-phosphor .ph-cadence li a {
	display: block;
}

.dz-phosphor .ph-cadence .ph-big {
	display: block;
	font-size: 40px;
	font-weight: 200;
	line-height: 1.1;
	color: var(--ink);
	font-variant-numeric: tabular-nums;
}

.dz-phosphor .ph-cadence .ph-slip .ph-big {
	color: var(--amber);
}

.dz-phosphor .ph-cadence .ph-label {
	display: block;
	margin-top: 4px;
	font-size: 12px;
	color: var(--ink-faint);
	white-space: nowrap;
}

/* Alerts */
.dz-phosphor .ph-alerts {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.dz-phosphor .ph-alerts li a {
	display: flex;
	align-items: baseline;
	gap: 0.7em;
}

.dz-phosphor .ph-alerts .ph-figure {
	color: var(--amber);
	font-variant-numeric: tabular-nums;
	min-width: 1.4em;
}

/* Schedule rows */
.dz-phosphor .ph-rows {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
}

.dz-phosphor .ph-row {
	display: flex;
	align-items: baseline;
	gap: 0.85em;
	padding: 9px 0;
	border-bottom: 1px solid var(--line);
}

.dz-phosphor .ph-row:last-child {
	border-bottom: none;
}

.dz-phosphor .ph-row .ph-time,
.dz-phosphor .ph-row .ph-box {
	flex: none;
	color: var(--ink-faint);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.dz-phosphor .ph-row .ph-box {
	color: var(--ink-dim);
}

.dz-phosphor .ph-row.ph-done .ph-box {
	color: var(--green);
}

.dz-phosphor .ph-row .ph-title {
	flex: 1 1 auto;
	min-width: 0;
	color: var(--ink);
}

.dz-phosphor .ph-row.ph-done .ph-title {
	color: var(--ink-faint);
	text-decoration: line-through;
	text-decoration-color: var(--ink-faint);
}

.dz-phosphor .ph-row .ph-meta {
	display: block;
	font-size: 12px;
	color: var(--ink-faint);
}

.dz-phosphor .ph-row .ph-token {
	flex: none;
	font-size: 11px;
	letter-spacing: 0.06em;
	white-space: nowrap;
}

.dz-phosphor .ph-token-overdue {
	color: var(--amber);
}

.dz-phosphor .ph-token-top3 {
	color: var(--ink-dim);
}

.dz-phosphor .ph-token-done {
	color: var(--green);
}

.dz-phosphor .ph-subheading {
	margin: 28px 0 10px;
	font-size: 11px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--ink-faint);
}

.dz-phosphor .ph-subheading:first-child {
	margin-top: 0;
}

/* Brief */
.dz-phosphor .ph-brief {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 24px;
}

.dz-phosphor .ph-brief-head {
	display: flex;
	align-items: baseline;
	gap: 0.7em;
	flex-wrap: wrap;
}

.dz-phosphor .ph-brief-name {
	color: var(--ink);
	font-weight: 500;
}

.dz-phosphor .ph-brief-figure {
	font-size: 22px;
	font-weight: 300;
	color: var(--ink-dim);
	font-variant-numeric: tabular-nums;
}

.dz-phosphor .ph-brief.ph-over .ph-brief-figure {
	color: var(--amber);
}

.dz-phosphor .ph-brief-unit {
	font-size: 12px;
	color: var(--ink-faint);
}

.dz-phosphor .ph-meter {
	display: block;
	margin: 8px 0;
	font-size: 12px;
	letter-spacing: 0.02em;
	color: var(--ink-faint);
	white-space: nowrap;
	overflow-x: auto;
}

.dz-phosphor .ph-brief.ph-over .ph-meter {
	color: var(--amber);
}

.dz-phosphor .ph-brief-action {
	color: var(--ink-dim);
	font-size: 13px;
}

/* Routines */
.dz-phosphor .ph-routine-bucket {
	margin-bottom: 18px;
}

.dz-phosphor .ph-routine-bucket:last-child {
	margin-bottom: 0;
}

.dz-phosphor .ph-routine-row {
	display: flex;
	align-items: baseline;
	gap: 0.7em;
	padding: 6px 0;
}

.dz-phosphor .ph-routine-row .ph-box {
	color: var(--ink-faint);
	flex: none;
}

.dz-phosphor .ph-routine-row.ph-done .ph-box {
	color: var(--green);
}

.dz-phosphor .ph-routine-row .ph-name {
	flex: 1 1 auto;
	color: var(--ink);
}

.dz-phosphor .ph-routine-row.ph-done .ph-name {
	color: var(--ink-dim);
}

.dz-phosphor .ph-routine-row .ph-streak {
	flex: none;
	font-size: 12px;
	color: var(--ink-faint);
	white-space: nowrap;
}

/* Projects */
.dz-phosphor .ph-projects {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 20px;
}

.dz-phosphor .ph-project-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.7em;
	margin-bottom: 6px;
}

.dz-phosphor .ph-project-name {
	color: var(--ink);
}

.dz-phosphor .ph-project-pct {
	color: var(--ink-dim);
	font-variant-numeric: tabular-nums;
}

.dz-phosphor .ph-project-bar {
	position: relative;
	height: 1px;
	background: var(--line);
	margin-bottom: 6px;
}

.dz-phosphor .ph-project-bar span {
	position: absolute;
	inset: 0 auto 0 0;
	height: 1px;
	background: var(--green);
}

.dz-phosphor .ph-project-next {
	font-size: 12px;
	color: var(--ink-faint);
}

/* Quotes */
.dz-phosphor .ph-quote {
	margin: 0;
	padding: 0;
	border: none;
}

.dz-phosphor .ph-quote p {
	margin: 0 0 8px;
	font-size: 16px;
	font-style: italic;
	color: var(--ink);
	line-height: 1.7;
}

.dz-phosphor .ph-quote footer {
	font-size: 12px;
	color: var(--ink-faint);
}

.dz-phosphor .ph-quote-actions {
	margin-top: 14px;
	display: flex;
	gap: 1.2em;
}

.dz-phosphor .ph-quote-actions button {
	background: none;
	border: none;
	padding: 0;
	color: var(--ink-dim);
	font-family: inherit;
	font-size: 12px;
	letter-spacing: 0.04em;
	cursor: pointer;
}

.dz-phosphor .ph-quote-actions button:hover {
	color: var(--amber);
}

/* Capture prompt */
.dz-phosphor .ph-capture {
	margin-top: 88px;
}

.dz-phosphor .ph-chips {
	list-style: none;
	margin: 0 0 20px;
	padding: 0;
	display: flex;
	flex-wrap: wrap;
	gap: 10px 18px;
}

.dz-phosphor .ph-chips button {
	background: none;
	border: 1px solid var(--line);
	border-radius: 2px;
	padding: 6px 12px;
	color: var(--ink-dim);
	font-family: inherit;
	font-size: 12px;
	cursor: pointer;
}

.dz-phosphor .ph-chips button:hover {
	color: var(--amber);
	border-color: var(--amber);
}

.dz-phosphor .ph-prompt-line {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 16px 18px;
	background: var(--bg-raised);
	border: 1px solid var(--line);
	border-radius: 2px;
	font-size: 15px;
	color: var(--ink-dim);
}

.dz-phosphor .ph-prompt-line .ph-chevron {
	color: var(--amber);
}

.dz-phosphor .ph-cursor {
	display: inline-block;
	width: 0.55em;
	height: 1.05em;
	background: var(--amber);
	animation: ph-blink 1s steps(1) infinite;
}

@media (prefers-reduced-motion: reduce) {
	.dz-phosphor .ph-cursor {
		animation: none;
	}
}

@keyframes ph-blink {
	0%,
	49% {
		opacity: 1;
	}
	50%,
	100% {
		opacity: 0;
	}
}

.dz-phosphor .sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.dz-phosphor .ph-mic-hint {
	margin-top: 10px;
	font-size: 11px;
	color: var(--ink-faint);
}

/* Container queries: desktop widens the margins, not the columns */
@container (min-width: 700px) {
	.dz-phosphor .ph-status {
		padding: 16px 40px;
	}

	.dz-phosphor .ph-main {
		max-width: 720px;
		padding: 72px 40px 120px;
	}

	.dz-phosphor .ph-section {
		margin-top: 88px;
	}

	.dz-phosphor .ph-rule {
		margin-top: 88px;
	}

	.dz-phosphor .ph-capture {
		margin-top: 112px;
	}

	.dz-phosphor .ph-anchor .ph-next {
		font-size: 34px;
	}

	.dz-phosphor .ph-cadence {
		grid-template-columns: repeat(5, auto);
		gap: 20px 40px;
		justify-content: start;
	}

	.dz-phosphor .ph-cadence .ph-big {
		font-size: 46px;
	}
}
`;

function meterBar(daysSince: number, thresholdDays: number, over: boolean) {
	const width = 20;
	const filled = Math.max(
		0,
		Math.min(width, Math.round((daysSince / Math.max(thresholdDays, 1)) * width)),
	);
	const bar = "=".repeat(filled) + "-".repeat(Math.max(0, width - filled));
	return `[${bar}] ${daysSince}/${thresholdDays}${over ? " OVER" : ""}`;
}

export function PhosphorDesign({ day }: { day: CompareDay }) {
	return (
		<div className="dz-phosphor">
			<style>{CSS}</style>

			<header className="ph-status">
				<span>
					<strong>{day.dateline}</strong>
				</span>
				<span>
					wk <strong>{day.isoWeek}</strong>
				</span>
				<span>{day.timezone}</span>
				<span className="ph-unread">{day.unreadNotifications} unread</span>
				<a className="ph-ask" href="/ask">
					ask →
				</a>
			</header>

			<main className="ph-main">
				<section className="ph-section ph-anchor" aria-label="Anchor">
					<div className="ph-next">
						<span className="ph-time">{day.anchor.nextEvent.time}</span>{" "}
						{day.anchor.nextEvent.title}
					</div>
					<div className="ph-sub">
						{day.anchor.eventCount} events today · {day.anchor.openCount} open ·{" "}
						{day.anchor.overdueCount} overdue
					</div>
				</section>

				<ul className="ph-cadence" aria-label="Cadence">
					{day.cadence.map((c) => (
						<li key={c.key} className={c.slip ? "ph-slip" : undefined}>
							<a href={c.href}>
								<span className="ph-big">{c.big}</span>
								<span className="ph-label">{c.label}</span>
							</a>
						</li>
					))}
				</ul>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="Alerts">
					<h2 className="ph-heading">Waiting on you</h2>
					<ul className="ph-alerts">
						{day.alerts.map((a) => (
							<li key={a.key}>
								<a href={a.href}>
									<span className="ph-figure">{a.count}</span>
									<span>{a.label}</span>
								</a>
							</li>
						))}
					</ul>
				</section>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="Day schedule">
					<h2 className="ph-heading">
						Day{" "}
						<span className="ph-count">
							{day.schedule.timeline.length + day.schedule.allDay.length} rows
						</span>
					</h2>

					{day.schedule.allDay.length > 0 && (
						<>
							<h3 className="ph-subheading">All day</h3>
							<ul className="ph-rows">
								{day.schedule.allDay.map((row) => (
									<li key={row.key} className={`ph-row${row.done ? " ph-done" : ""}`}>
										<span className="ph-box" aria-hidden="true">
											{row.kind === "task" ? (row.done ? "[x]" : "[ ]") : "[·]"}
										</span>
										<span className="ph-title">
											{row.title}
											<span className="ph-meta">{row.meta}</span>
										</span>
										{row.top3 && !row.done && (
											<span className="ph-token ph-token-top3">[TOP3]</span>
										)}
										{row.done && <span className="ph-token ph-token-done">[DONE]</span>}
									</li>
								))}
							</ul>
						</>
					)}

					<h3 className="ph-subheading">Timeline</h3>
					<ul className="ph-rows">
						{day.schedule.timeline.map((row) => (
							<li key={row.key} className={`ph-row${row.done ? " ph-done" : ""}`}>
								<span className="ph-time">{row.time}</span>
								{row.kind === "task" && (
									<span className="ph-box" aria-hidden="true">
										{row.done ? "[x]" : "[ ]"}
									</span>
								)}
								<span className="ph-title">
									{row.title}
									<span className="ph-meta">{row.meta}</span>
								</span>
								{row.top3 && !row.done && <span className="ph-token ph-token-top3">[TOP3]</span>}
								{row.done && <span className="ph-token ph-token-done">[DONE]</span>}
							</li>
						))}
					</ul>

					<h3 className="ph-subheading">Open</h3>
					<ul className="ph-rows">
						{day.schedule.open.map((row) => (
							<li key={row.key} className="ph-row">
								<span className="ph-box" aria-hidden="true">
									[ ]
								</span>
								<span className="ph-title">
									{row.title}
									<span className="ph-meta">{row.meta}</span>
								</span>
								{row.overdue && <span className="ph-token ph-token-overdue">[OVERDUE]</span>}
							</li>
						))}
					</ul>
				</section>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="In brief">
					<h2 className="ph-heading">In brief</h2>
					<ul className="ph-brief">
						{day.brief.map((b) => {
							const over = b.daysSince >= b.thresholdDays;
							return (
								<li key={b.key} className={`ph-brief${over ? " ph-over" : ""}`}>
									<div className="ph-brief-head">
										<a className="ph-brief-name" href={b.href}>
											{b.name}
										</a>
										<span className="ph-brief-figure">{b.daysSince}</span>
										<span className="ph-brief-unit">{b.unit}</span>
									</div>
									<span className="ph-meter" aria-hidden="true">
										{meterBar(b.daysSince, b.thresholdDays, over)}
									</span>
									<div className="ph-brief-action">{b.nextAction}</div>
								</li>
							);
						})}
					</ul>
				</section>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="Routines">
					<h2 className="ph-heading">
						Routines{" "}
						<span className="ph-count">
							{day.routines.done}/{day.routines.total}
						</span>
					</h2>
					{day.routines.buckets.map((bucket) => (
						<div className="ph-routine-bucket" key={bucket.bucket}>
							<h3 className="ph-subheading">{bucket.bucket}</h3>
							{bucket.rows.map((r) => (
								<div key={r.id} className={`ph-routine-row${r.done ? " ph-done" : ""}`}>
									<span className="ph-box" aria-hidden="true">
										{r.done ? "[x]" : "[ ]"}
									</span>
									<span className="ph-name">
										{r.name}
										{r.time ? <span className="ph-meta"> {r.time}</span> : null}
									</span>
									<span className="ph-streak">{r.streak}d streak</span>
								</div>
							))}
						</div>
					))}
				</section>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="Projects">
					<h2 className="ph-heading">Projects</h2>
					<ul className="ph-projects">
						{day.projects.map((p) => (
							<li key={p.id}>
								<div className="ph-project-head">
									<span className="ph-project-name">{p.name}</span>
									<span className="ph-project-pct">{Math.round(p.progress * 100)}%</span>
								</div>
								<div className="ph-project-bar" aria-hidden="true">
									<span style={{ width: `${Math.round(p.progress * 100)}%` }} />
								</div>
								<div className="ph-project-next">{p.nextMilestone}</div>
							</li>
						))}
					</ul>
				</section>

				<hr className="ph-rule" />

				<section className="ph-section" aria-label="Resurfaced quote">
					<h2 className="ph-heading">Resurfaced</h2>
					<blockquote className="ph-quote">
						<p>&ldquo;{day.resurfaced.text}&rdquo;</p>
						<footer>
							— {day.resurfaced.author}, {day.resurfaced.reference}
						</footer>
					</blockquote>
					<div className="ph-quote-actions">
						<button type="button">Next</button>
						<button type="button">Reset ({day.resurfaced.skips})</button>
					</div>

					<h3 className="ph-subheading">Latest</h3>
					<blockquote className="ph-quote">
						<p>&ldquo;{day.latestQuote.text}&rdquo;</p>
						<footer>
							— {day.latestQuote.author}, {day.latestQuote.reference}
						</footer>
					</blockquote>
				</section>

				<section className="ph-section ph-capture" aria-label="Capture">
					<ul className="ph-chips">
						{day.capture.map((c) => (
							<li key={c}>
								<button type="button">{c}</button>
							</li>
						))}
					</ul>
					<div className="ph-prompt-line">
						<span className="ph-chevron" aria-hidden="true">
							&gt;
						</span>
						<span aria-hidden="true">_</span>
						<span className="ph-cursor" aria-hidden="true" />
						<span className="sr-only">Capture prompt, hold the mic to speak</span>
					</div>
					<div className="ph-mic-hint">hold the mic to speak · release to capture</div>
				</section>
			</main>
		</div>
	);
}
