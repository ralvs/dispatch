import type { CompareDay } from "../mock";

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,340;9..144,480&family=Albert+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap");

.dz-nocturne {
	min-height: 100%;
	background: #14120f;
	color: #ece6da;
	font-family: "Albert Sans", ui-sans-serif, system-ui, sans-serif;
	line-height: 1.5;
	padding: 40px 20px 96px;
}

.dz-nocturne * {
	box-sizing: border-box;
}

.dz-nocturne a {
	color: inherit;
}

.dz-nocturne .n-brass {
	color: #c9a86a;
}

.dz-nocturne .n-whisper {
	color: #8d8477;
}

.dz-nocturne .n-mono {
	font-family: "JetBrains Mono", ui-monospace, monospace;
}

/* header */
.dz-nocturne .n-header {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px 20px;
	font-size: 11px;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	color: #8d8477;
}

.dz-nocturne .n-header-left {
	display: flex;
	flex-wrap: wrap;
	align-items: baseline;
	gap: 6px 14px;
}

.dz-nocturne .n-ask {
	background: none;
	border: none;
	color: #c9a86a;
	font: inherit;
	letter-spacing: 0.14em;
	text-transform: uppercase;
	cursor: pointer;
	padding: 0;
	text-decoration: none;
	position: relative;
}

.dz-nocturne .n-ask:hover {
	color: #ece6da;
}

.dz-nocturne .n-unread {
	position: relative;
}

.dz-nocturne .n-unread::after {
	content: "";
	position: absolute;
	top: -2px;
	right: -8px;
	width: 4px;
	height: 4px;
	border-radius: 50%;
	background: #c9a86a;
}

/* hero */
.dz-nocturne .n-hero {
	margin-top: 64px;
	max-width: 34ch;
}

.dz-nocturne .n-hero-sentence {
	font-family: "Fraunces", Georgia, serif;
	font-optical-sizing: auto;
	font-weight: 340;
	font-size: 30px;
	line-height: 1.32;
	letter-spacing: -0.01em;
	color: #f5f0e6;
}

.dz-nocturne .n-hero-sentence .n-fig {
	font-weight: 480;
	font-variant-numeric: oldstyle-nums;
	color: #f5f0e6;
}

.dz-nocturne .n-hero-rule {
	margin: 22px 0 18px;
	border: none;
	border-top: 1px solid rgba(201, 168, 106, 0.55);
	width: 72px;
}

.dz-nocturne .n-hero-next {
	font-size: 14px;
	color: #b9ae9c;
}

.dz-nocturne .n-hero-next a {
	color: #c9a86a;
	text-decoration: none;
	border-bottom: 1px solid rgba(201, 168, 106, 0.4);
}

.dz-nocturne .n-hero-next a:hover {
	border-bottom-color: #c9a86a;
}

/* cadence whisper line */
.dz-nocturne .n-cadence {
	margin-top: 28px;
	font-size: 12px;
	color: #8d8477;
	display: flex;
	flex-wrap: wrap;
	gap: 4px 0;
}

.dz-nocturne .n-cadence a {
	text-decoration: none;
	color: inherit;
	white-space: nowrap;
}

.dz-nocturne .n-cadence a:hover {
	color: #ece6da;
}

.dz-nocturne .n-cadence .n-fig {
	font-family: "JetBrains Mono", monospace;
	color: #b9ae9c;
}

.dz-nocturne .n-cadence .n-slip .n-fig {
	color: #c9a86a;
}

.dz-nocturne .n-cadence .n-sep {
	margin: 0 10px;
	color: #4a4438;
}

/* disclosure stack */
.dz-nocturne .n-stack {
	margin-top: 72px;
	display: flex;
	flex-direction: column;
}

.dz-nocturne .n-section {
	border-top: 1px solid rgba(201, 168, 106, 0.22);
	padding: 22px 0;
}

.dz-nocturne .n-section:last-child {
	border-bottom: 1px solid rgba(201, 168, 106, 0.22);
}

.dz-nocturne .n-section summary {
	list-style: none;
	cursor: pointer;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 16px;
	font-size: 13px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: #ece6da;
}

.dz-nocturne .n-section summary::-webkit-details-marker {
	display: none;
}

.dz-nocturne .n-section summary .n-summary-meta {
	font-size: 11px;
	letter-spacing: 0.04em;
	text-transform: none;
	color: #8d8477;
	font-family: "JetBrains Mono", monospace;
}

.dz-nocturne .n-section summary .n-caret {
	color: #c9a86a;
	transition: transform 0.18s ease;
	font-size: 11px;
	display: inline-block;
}

.dz-nocturne .n-section[open] summary .n-caret {
	transform: rotate(90deg);
}

.dz-nocturne .n-body {
	margin-top: 22px;
	font-size: 14px;
}

/* rows shared */
.dz-nocturne .n-row {
	display: flex;
	align-items: baseline;
	gap: 14px;
	padding: 9px 0;
	border-top: 1px solid rgba(201, 168, 106, 0.1);
}

.dz-nocturne .n-row:first-child {
	border-top: none;
}

.dz-nocturne .n-row-time {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	color: #8d8477;
	min-width: 3.4em;
	flex-shrink: 0;
}

.dz-nocturne .n-row-main {
	flex: 1;
	min-width: 0;
}

.dz-nocturne .n-row-title {
	color: #ece6da;
	font-size: 14px;
}

.dz-nocturne .n-row-title.n-done {
	color: #6f695c;
	text-decoration: line-through;
	text-decoration-color: rgba(201, 168, 106, 0.4);
}

.dz-nocturne .n-row-meta {
	font-size: 11px;
	color: #8d8477;
	margin-top: 2px;
}

.dz-nocturne .n-mark {
	color: #c9a86a;
	margin-right: 6px;
}

.dz-nocturne .n-tag {
	font-size: 10px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #c9a86a;
	margin-left: 8px;
}

/* brief */
.dz-nocturne .n-brief-row {
	padding: 12px 0;
	border-top: 1px solid rgba(201, 168, 106, 0.1);
}

.dz-nocturne .n-brief-row:first-child {
	border-top: none;
}

.dz-nocturne .n-brief-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.dz-nocturne .n-brief-name a {
	color: #ece6da;
	text-decoration: none;
	font-size: 14px;
}

.dz-nocturne .n-brief-name a:hover {
	color: #c9a86a;
}

.dz-nocturne .n-brief-count {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	color: #8d8477;
	white-space: nowrap;
}

.dz-nocturne .n-brief-count.n-over {
	color: #c9a86a;
}

.dz-nocturne .n-brief-action {
	font-size: 12px;
	color: #8d8477;
	margin-top: 4px;
}

/* routines */
.dz-nocturne .n-bucket {
	margin-top: 16px;
}

.dz-nocturne .n-bucket:first-child {
	margin-top: 0;
}

.dz-nocturne .n-bucket-label {
	font-size: 10px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: #8d8477;
	margin-bottom: 6px;
}

.dz-nocturne .n-routine-row {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 0;
}

.dz-nocturne .n-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	border: 1px solid #8d8477;
	flex-shrink: 0;
}

.dz-nocturne .n-dot.n-dot-done {
	background: #c9a86a;
	border-color: #c9a86a;
}

.dz-nocturne .n-routine-name {
	flex: 1;
	font-size: 13px;
	color: #ece6da;
}

.dz-nocturne .n-routine-name.n-done {
	color: #6f695c;
}

.dz-nocturne .n-routine-streak {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	color: #8d8477;
}

/* projects */
.dz-nocturne .n-project-row {
	padding: 12px 0;
	border-top: 1px solid rgba(201, 168, 106, 0.1);
}

.dz-nocturne .n-project-row:first-child {
	border-top: none;
}

.dz-nocturne .n-project-head {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.dz-nocturne .n-project-name {
	font-size: 14px;
	color: #ece6da;
}

.dz-nocturne .n-project-pct {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	color: #c9a86a;
}

.dz-nocturne .n-project-bar {
	margin-top: 8px;
	height: 1px;
	background: rgba(201, 168, 106, 0.16);
	position: relative;
}

.dz-nocturne .n-project-bar-fill {
	position: absolute;
	top: 0;
	left: 0;
	height: 1px;
	background: #c9a86a;
}

.dz-nocturne .n-project-milestone {
	font-size: 12px;
	color: #8d8477;
	margin-top: 6px;
}

/* quote */
.dz-nocturne .n-quote {
	font-family: "Fraunces", Georgia, serif;
	font-weight: 340;
	font-size: 19px;
	line-height: 1.5;
	color: #f5f0e6;
	margin: 0;
	max-width: 30ch;
}

.dz-nocturne .n-quote-cite {
	display: block;
	margin-top: 10px;
	font-family: "Albert Sans", sans-serif;
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: #8d8477;
}

.dz-nocturne .n-quote-actions {
	margin-top: 16px;
	display: flex;
	gap: 18px;
}

.dz-nocturne .n-quote-actions button {
	background: none;
	border: none;
	font: inherit;
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #c9a86a;
	cursor: pointer;
	padding: 2px 0;
}

.dz-nocturne .n-quote-actions button:hover {
	color: #ece6da;
}

.dz-nocturne .n-quote-block {
	margin-top: 18px;
	padding-top: 18px;
	border-top: 1px solid rgba(201, 168, 106, 0.12);
}

.dz-nocturne .n-quote-block:first-child {
	margin-top: 0;
	padding-top: 0;
	border-top: none;
}

/* capture */
.dz-nocturne .n-capture {
	margin-top: 72px;
	text-align: center;
}

.dz-nocturne .n-capture-hint {
	font-size: 12px;
	color: #8d8477;
	letter-spacing: 0.04em;
}

.dz-nocturne .n-capture-hint .n-brass {
	color: #c9a86a;
}

.dz-nocturne .n-capture-chips {
	margin-top: 16px;
	display: flex;
	justify-content: center;
	flex-wrap: wrap;
	gap: 6px 18px;
}

.dz-nocturne .n-capture-chips button {
	background: none;
	border: none;
	font: inherit;
	font-size: 12px;
	letter-spacing: 0.04em;
	color: #b9ae9c;
	cursor: pointer;
	padding: 2px 0;
	text-decoration: underline;
	text-decoration-color: rgba(201, 168, 106, 0.3);
	text-underline-offset: 3px;
}

.dz-nocturne .n-capture-chips button:hover {
	color: #ece6da;
	text-decoration-color: #c9a86a;
}

.dz-nocturne :focus-visible {
	outline: 1px solid #c9a86a;
	outline-offset: 3px;
}

@container (min-width: 700px) {
	.dz-nocturne {
		padding: 56px 64px 120px;
	}

	.dz-nocturne .n-hero {
		margin-top: 88px;
		/* Wide enough that the sentence breathes in 3-4 lines instead of
		 * stacking into a narrow phone column on a 1180px canvas. */
		max-width: 44ch;
	}

	.dz-nocturne .n-hero-sentence {
		font-size: 40px;
	}

	.dz-nocturne .n-stack {
		margin-top: 96px;
		max-width: 56ch;
	}

	.dz-nocturne .n-quote-wrap {
		max-width: 56ch;
	}
}

@media (prefers-reduced-motion: reduce) {
	.dz-nocturne * {
		transition: none !important;
		animation: none !important;
	}
}
`;

export function NocturneDesign({ day }: { day: CompareDay }) {
	const { anchor } = day;

	return (
		<div className="dz-nocturne">
			<style>{CSS}</style>

			<header className="n-header">
				<div className="n-header-left">
					<span>{day.dateline}</span>
					<span>Week {day.isoWeek}</span>
					<span className="n-mono">{day.timezone}</span>
				</div>
				<div className="n-header-left">
					<span className="n-unread">{day.unreadNotifications} unread</span>
					<button type="button" className="n-ask" aria-label="Ask Dispatch">
						Ask
					</button>
				</div>
			</header>

			<section className="n-hero" aria-label="Day summary">
				<p className="n-hero-sentence">
					<span className="n-fig">{anchor.eventCount}</span> events; the next at{" "}
					<span className="n-fig">{anchor.nextEvent.time}</span> — {anchor.nextEvent.title}.{" "}
					<span className="n-fig">{anchor.openCount}</span> tasks open,{" "}
					<span className="n-fig">{anchor.overdueCount}</span> overdue.
				</p>
				<hr className="n-hero-rule" />
				<p className="n-hero-next">
					Next: <a href="/today">{anchor.nextEvent.title}</a> at {anchor.nextEvent.time}
				</p>
			</section>

			<section aria-label="Cadence" className="n-cadence">
				{day.cadence.map((c, i) => (
					<span key={c.key} className={c.slip ? "n-slip" : ""}>
						<a href={c.href}>
							<span className="n-fig">{c.big}</span> {c.label}
						</a>
						{i < day.cadence.length - 1 && <span className="n-sep">·</span>}
					</span>
				))}
			</section>

			<div className="n-stack">
				<details className="n-section" open>
					<summary>
						<span>Decisions waiting</span>
						<span className="n-summary-meta">
							{day.alerts.reduce((sum, a) => sum + a.count, 0)} total{" "}
							<span className="n-caret">›</span>
						</span>
					</summary>
					<div className="n-body">
						{day.alerts.map((a) => (
							<div className="n-row" key={a.key}>
								<span className="n-row-main">
									<a href={a.href} className="n-row-title">
										<span className="n-fig n-mono">{a.count}</span> {a.label}
									</a>
								</span>
							</div>
						))}
					</div>
				</details>

				<details className="n-section">
					<summary>
						<span>Today's schedule</span>
						<span className="n-summary-meta">
							{day.schedule.timeline.length + day.schedule.allDay.length} items{" "}
							<span className="n-caret">›</span>
						</span>
					</summary>
					<div className="n-body">
						{day.schedule.allDay.map((row) => (
							<div className="n-row" key={row.key}>
								<span className="n-row-time n-mono">all day</span>
								<span className="n-row-main">
									<span className={`n-row-title${row.done ? " n-done" : ""}`}>{row.title}</span>
									{row.top3 && <span className="n-tag">Top 3</span>}
									<div className="n-row-meta">{row.meta}</div>
								</span>
							</div>
						))}
						{day.schedule.timeline.map((row) => (
							<div className="n-row" key={row.key}>
								<span className="n-row-time n-mono">{row.time}</span>
								<span className="n-row-main">
									<span className={`n-row-title${row.done ? " n-done" : ""}`}>{row.title}</span>
									{row.top3 && <span className="n-tag">Top 3</span>}
									<div className="n-row-meta">{row.meta}</div>
								</span>
							</div>
						))}
						{day.schedule.open.map((row) => (
							<div className="n-row" key={row.key}>
								<span className="n-row-time n-mono">{row.overdue ? "" : ""}</span>
								<span className="n-row-main">
									<span className="n-row-title">
										{row.overdue && (
											<span className="n-mark" aria-hidden="true">
												✦
											</span>
										)}
										{row.title}
									</span>
									<div className="n-row-meta">{row.meta}</div>
								</span>
							</div>
						))}
					</div>
				</details>

				<details className="n-section">
					<summary>
						<span>In brief</span>
						<span className="n-summary-meta">
							{day.brief.length} domains <span className="n-caret">›</span>
						</span>
					</summary>
					<div className="n-body">
						{day.brief.map((b) => {
							const over = b.daysSince >= b.thresholdDays;
							return (
								<div className="n-brief-row" key={b.key}>
									<div className="n-brief-head">
										<span className="n-brief-name">
											<a href={b.href}>{b.name}</a>
										</span>
										<span className={`n-brief-count n-mono${over ? " n-over" : ""}`}>
											{over && (
												<span className="n-mark" aria-hidden="true">
													✦
												</span>
											)}
											{b.daysSince} / {b.thresholdDays} {b.unit}
										</span>
									</div>
									<div className="n-brief-action">{b.nextAction}</div>
								</div>
							);
						})}
					</div>
				</details>

				<details className="n-section">
					<summary>
						<span>Routines</span>
						<span className="n-summary-meta">
							<span className="n-fig">{day.routines.done}</span>/{day.routines.total}{" "}
							<span className="n-caret">›</span>
						</span>
					</summary>
					<div className="n-body">
						{day.routines.buckets.map((bucket) => (
							<div className="n-bucket" key={bucket.bucket}>
								<div className="n-bucket-label">{bucket.bucket}</div>
								{bucket.rows.map((r) => (
									<div className="n-routine-row" key={r.id}>
										<span className={`n-dot${r.done ? " n-dot-done" : ""}`} aria-hidden="true" />
										<span className={`n-routine-name${r.done ? " n-done" : ""}`}>
											{r.name}
											{r.time ? ` — ${r.time}` : ""}
										</span>
										<span className="n-routine-streak n-mono">{r.streak}d streak</span>
									</div>
								))}
							</div>
						))}
					</div>
				</details>

				<details className="n-section">
					<summary>
						<span>Projects</span>
						<span className="n-summary-meta">
							{day.projects.length} active <span className="n-caret">›</span>
						</span>
					</summary>
					<div className="n-body">
						{day.projects.map((p) => (
							<div className="n-project-row" key={p.id}>
								<div className="n-project-head">
									<span className="n-project-name">{p.name}</span>
									<span className="n-project-pct n-mono">{Math.round(p.progress * 100)}%</span>
								</div>
								<div className="n-project-bar">
									<div
										className="n-project-bar-fill"
										style={{ width: `${Math.round(p.progress * 100)}%` }}
									/>
								</div>
								<div className="n-project-milestone">Next — {p.nextMilestone}</div>
							</div>
						))}
					</div>
				</details>
			</div>

			<section className="n-quote-wrap" aria-label="Resurfaced words" style={{ marginTop: "72px" }}>
				<div className="n-quote-block">
					<blockquote className="n-quote">
						{day.resurfaced.text}
						<span className="n-quote-cite">
							{day.resurfaced.author} — {day.resurfaced.reference}
						</span>
					</blockquote>
					<div className="n-quote-actions">
						<button type="button">Next</button>
						<button type="button">Reset</button>
					</div>
				</div>
				<div className="n-quote-block">
					<blockquote className="n-quote">
						{day.latestQuote.text}
						<span className="n-quote-cite">
							{day.latestQuote.author} — {day.latestQuote.reference}
						</span>
					</blockquote>
				</div>
			</section>

			<section className="n-capture" aria-label="Capture">
				<p className="n-capture-hint">
					Hold the <span className="n-brass">mic</span> to capture anything
				</p>
				<div className="n-capture-chips">
					{day.capture.map((c) => (
						<button type="button" key={c}>
							{c}
						</button>
					))}
				</div>
			</section>
		</div>
	);
}
