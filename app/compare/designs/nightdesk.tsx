import type { CompareDay } from "../mock";

export function NightdeskDesign({ day }: { day: CompareDay }) {
	const { anchor } = day;

	return (
		<div className="dz-nightdesk">
			<style>{CSS}</style>

			<header className="dz-masthead">
				<div className="dz-masthead-row">
					<p className="dz-folio">
						{day.dateline} <span className="dz-folio-sep">·</span> Week {day.isoWeek}{" "}
						<span className="dz-folio-sep">·</span> {day.timezone}
					</p>
					<a className="dz-ask" href="/chat">
						Ask →
					</a>
				</div>
				<h1 className="dz-nameplate">The Nightdesk</h1>
				<p className="dz-masthead-sub">
					{day.weekday} edition <span className="dz-folio-sep">·</span> {day.nowLabel}{" "}
					<span className="dz-folio-sep">·</span>{" "}
					{day.unreadNotifications === 1
						? "1 unread notification"
						: `${day.unreadNotifications} unread notifications`}
				</p>
			</header>

			<section className="dz-lede" aria-label="Today's anchor">
				<p className="dz-lede-text">
					{anchor.eventCount === 1 ? "One event" : `${anchor.eventCount} events`} today; the next at{" "}
					{anchor.nextEvent.time} — {anchor.nextEvent.title}.{" "}
					{anchor.openCount === 1 ? "One task" : `${anchor.openCount} tasks`} open,{" "}
					{anchor.overdueCount === 0
						? "none of it late."
						: anchor.overdueCount === 1
							? "one running late."
							: `${anchor.overdueCount} running late.`}
				</p>
				<p className="dz-kicker">
					<span className="dz-kicker-label">Next thing</span>
					<span className="dz-kicker-sep">—</span>
					{anchor.nextEvent.time} <span className="dz-folio-sep">·</span> {anchor.nextEvent.title}
				</p>
			</section>

			<section className="dz-agate" aria-label="By the numbers">
				<div className="dz-rule dz-rule--label">
					<span>By the numbers</span>
				</div>
				<ul className="dz-agate-list">
					{day.cadence.map((c) => (
						<li key={c.key} className={c.slip ? "dz-agate-item is-slip" : "dz-agate-item"}>
							<a href={c.href}>
								<span className="dz-agate-big">{c.big}</span>
								<span className="dz-agate-label">{c.label}</span>
							</a>
						</li>
					))}
				</ul>
			</section>

			{day.alerts.length > 0 && (
				<section className="dz-alerts" aria-label="Awaiting a decision">
					<div className="dz-rule dz-rule--label">
						<span>Awaiting a decision</span>
					</div>
					<ul className="dz-alerts-list">
						{day.alerts.map((a) => (
							<li key={a.key} className="dz-alerts-item">
								<a href={a.href}>
									<span className="dz-alerts-count">{a.count}</span> {a.label}
								</a>
							</li>
						))}
					</ul>
				</section>
			)}

			<div className="dz-columns">
				<section className="dz-schedule" aria-label="Day schedule">
					<div className="dz-rule dz-rule--label">
						<span>The day</span>
					</div>

					{day.schedule.allDay.length > 0 && (
						<ul className="dz-rows dz-rows--allday">
							{day.schedule.allDay.map((row) => (
								<li
									key={row.key}
									className={row.top3 ? "dz-row is-top3" : "dz-row"}
									data-kind={row.kind}
								>
									<span className="dz-row-time">All&nbsp;day</span>
									<span className="dz-row-title">
										{row.title}
										{row.top3 && <span className="dz-row-flag">Top 3</span>}
									</span>
									<span className="dz-row-meta">{row.meta}</span>
								</li>
							))}
						</ul>
					)}

					<ul className="dz-rows">
						{day.schedule.timeline.map((row) => (
							<li
								key={row.key}
								className={row.done ? "dz-row is-done" : row.top3 ? "dz-row is-top3" : "dz-row"}
								data-kind={row.kind}
							>
								<span className="dz-row-time">{row.time}</span>
								<span className="dz-row-title">
									{row.title}
									{row.top3 && <span className="dz-row-flag">Top 3</span>}
								</span>
								<span className="dz-row-meta">{row.meta}</span>
							</li>
						))}
					</ul>

					{day.schedule.open.length > 0 && (
						<>
							<p className="dz-subhead">Open, unscheduled</p>
							<ul className="dz-rows">
								{day.schedule.open.map((row) => (
									<li
										key={row.key}
										className={row.overdue ? "dz-row is-overdue" : "dz-row"}
										data-kind="task"
									>
										<span className="dz-row-time">—</span>
										<span className="dz-row-title">
											{row.title}
											{row.top3 && <span className="dz-row-flag">Top 3</span>}
										</span>
										<span className="dz-row-meta">{row.meta}</span>
									</li>
								))}
							</ul>
						</>
					)}
				</section>

				<aside className="dz-secondary">
					<section aria-label="In brief">
						<div className="dz-rule dz-rule--label">
							<span>In brief</span>
						</div>
						<ul className="dz-brief">
							{day.brief.map((b) => (
								<li key={b.key} className={b.slipping ? "dz-brief-item is-slip" : "dz-brief-item"}>
									<a href={b.href}>
										<span className="dz-brief-head">
											<span className="dz-brief-name">{b.name}</span>
											<span className="dz-brief-days">
												{b.daysSince} {b.unit}
											</span>
										</span>
										<span className="dz-brief-action">{b.nextAction}</span>
									</a>
								</li>
							))}
						</ul>
					</section>

					<section aria-label="Routines">
						<div className="dz-rule dz-rule--label">
							<span>
								Routines <span className="dz-folio-sep">·</span> {day.routines.done}/
								{day.routines.total}
							</span>
						</div>
						{day.routines.buckets.map((bucket) => (
							<div key={bucket.bucket} className="dz-routine-bucket">
								<p className="dz-bucket-label">{bucket.bucket}</p>
								<ul className="dz-routines">
									{bucket.rows.map((r) => (
										<li key={r.id} className={r.done ? "dz-routine-row is-done" : "dz-routine-row"}>
											<span className="dz-routine-check" aria-hidden="true">
												{r.done ? "✓" : "○"}
											</span>
											<span className="dz-routine-name">{r.name}</span>
											<span className="dz-routine-streak">
												{r.time ? `${r.time} · ` : ""}
												{r.streak}d
											</span>
										</li>
									))}
								</ul>
							</div>
						))}
					</section>

					<section aria-label="Projects">
						<div className="dz-rule dz-rule--label">
							<span>Projects</span>
						</div>
						<ul className="dz-projects">
							{day.projects.map((p) => (
								<li key={p.id} className="dz-project-row">
									<div className="dz-project-head">
										<span className="dz-project-name">{p.name}</span>
										<span className="dz-project-pct">{Math.round(p.progress * 100)}%</span>
									</div>
									<div className="dz-project-bar" aria-hidden="true">
										<span
											className="dz-project-bar-fill"
											style={{ width: `${Math.round(p.progress * 100)}%` }}
										/>
									</div>
									<p className="dz-project-next">{p.nextMilestone}</p>
								</li>
							))}
						</ul>
					</section>

					<section aria-label="Resurfaced quote">
						<div className="dz-rule dz-rule--label">
							<span>From the archive</span>
						</div>
						<blockquote className="dz-pullquote">
							<p>{day.resurfaced.text}</p>
							<footer>
								{day.resurfaced.author}
								{day.resurfaced.reference ? `, ${day.resurfaced.reference}` : ""}
							</footer>
						</blockquote>
						<div className="dz-quote-controls">
							<button type="button" className="dz-quote-btn">
								Next
							</button>
							<button type="button" className="dz-quote-btn">
								Reset
							</button>
							<span className="dz-quote-skips">skipped {day.resurfaced.skips}×</span>
						</div>

						<p className="dz-subhead">Latest capture</p>
						<blockquote className="dz-pullquote dz-pullquote--minor">
							<p>{day.latestQuote.text}</p>
							<footer>
								{day.latestQuote.author}
								{day.latestQuote.reference ? `, ${day.latestQuote.reference}` : ""}
							</footer>
						</blockquote>
					</section>
				</aside>
			</div>

			<section className="dz-capture" aria-label="Capture">
				<div className="dz-rule dz-rule--label">
					<span>Capture</span>
				</div>
				<ul className="dz-capture-chips">
					{day.capture.map((c) => (
						<li key={c} className="dz-capture-chip">
							{c}
						</li>
					))}
				</ul>
				<p className="dz-capture-hint">
					Hold the mic button anywhere to file it under the right kind.
				</p>
			</section>
		</div>
	);
}

const CSS = `
@import url("https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;1,8..60,400&family=JetBrains+Mono:wght@400;500&display=swap");

.dz-nightdesk {
	container-type: inline-size;
	min-height: 100%;
	background: #11161e;
	color: #e8e2d6;
	font-family: "Source Serif 4", Georgia, serif;
	font-size: 16px;
	line-height: 1.6;
	padding: 40px 20px 72px;
	box-sizing: border-box;
}

.dz-nightdesk * {
	box-sizing: border-box;
}

.dz-nightdesk a {
	color: inherit;
	text-decoration: none;
}

.dz-nightdesk a:hover {
	text-decoration: underline;
	text-decoration-color: rgba(232, 226, 214, 0.4);
}

.dz-nightdesk :focus-visible {
	outline: 1px solid #d99a4e;
	outline-offset: 3px;
}

.dz-nightdesk button {
	font-family: "JetBrains Mono", monospace;
	background: transparent;
	color: #b9c3d1;
	border: 1px solid rgba(232, 226, 214, 0.22);
	padding: 6px 14px;
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	cursor: pointer;
	border-radius: 2px;
}

.dz-nightdesk button:hover {
	border-color: rgba(232, 226, 214, 0.5);
}

/* ---------- Masthead ---------- */

.dz-masthead {
	max-width: 720px;
	margin: 0 auto 64px;
	padding-bottom: 28px;
	border-bottom: 1px solid rgba(232, 226, 214, 0.16);
}

.dz-masthead-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 12px;
}

.dz-folio {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #8b93a3;
	margin: 0;
}

.dz-folio-sep {
	color: #545c6b;
}

.dz-ask {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #d99a4e;
	white-space: nowrap;
}

.dz-nameplate {
	font-family: "Newsreader", serif;
	font-weight: 600;
	font-style: normal;
	font-size: clamp(2.4rem, 10vw, 3.2rem);
	letter-spacing: -0.01em;
	margin: 10px 0 8px;
	color: #f4efe4;
}

.dz-masthead-sub {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: #8b93a3;
	margin: 0;
}

/* ---------- Lede ---------- */

.dz-lede {
	max-width: 720px;
	margin: 0 auto 72px;
}

.dz-lede-text {
	font-family: "Newsreader", serif;
	font-weight: 500;
	font-style: normal;
	font-size: clamp(1.5rem, 5vw, 2.15rem);
	line-height: 1.32;
	letter-spacing: -0.005em;
	color: #f4efe4;
	margin: 0 0 24px;
}

.dz-kicker {
	position: relative;
	font-family: "JetBrains Mono", monospace;
	font-size: 12px;
	letter-spacing: 0.05em;
	color: #b9c3d1;
	margin: 0;
	padding-left: 0;
}

.dz-kicker-label {
	text-transform: uppercase;
	color: #d99a4e;
}

.dz-kicker-sep {
	margin: 0 8px;
	color: #545c6b;
}

/* ---------- Rules / section heads ---------- */

.dz-rule {
	position: relative;
	text-align: center;
	margin: 0 0 28px;
	height: 1px;
	background: rgba(232, 226, 214, 0.16);
}

.dz-rule span {
	position: relative;
	top: -10px;
	display: inline-block;
	background: #11161e;
	padding: 0 16px;
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.12em;
	text-transform: uppercase;
	color: #8b93a3;
	white-space: nowrap;
}

.dz-subhead {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: #8b93a3;
	margin: 32px 0 12px;
}

/* ---------- Agate (cadence) ---------- */

.dz-agate {
	max-width: 900px;
	margin: 0 auto 72px;
}

.dz-agate-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 32px 44px;
}

.dz-agate-item a {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	text-decoration: none;
}

.dz-agate-big {
	font-family: "JetBrains Mono", monospace;
	font-variant-numeric: tabular-nums;
	font-size: 2rem;
	font-weight: 500;
	color: #e8e2d6;
	line-height: 1;
}

.dz-agate-item.is-slip .dz-agate-big {
	color: #d99a4e;
}

.dz-agate-label {
	font-family: "JetBrains Mono", monospace;
	font-size: 10.5px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #8b93a3;
	white-space: nowrap;
}

/* ---------- Alerts ---------- */

.dz-alerts {
	max-width: 720px;
	margin: 0 auto 72px;
}

.dz-alerts-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.dz-alerts-item a {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	padding: 10px 0;
	border-bottom: 1px solid rgba(232, 226, 214, 0.1);
	font-size: 14px;
	color: #cdd4de;
}

.dz-alerts-count {
	font-family: "JetBrains Mono", monospace;
	font-variant-numeric: tabular-nums;
	color: #d99a4e;
	margin-right: 6px;
}

/* ---------- Columns ---------- */

.dz-columns {
	max-width: 1080px;
	margin: 0 auto;
	display: grid;
	grid-template-columns: 1fr;
	gap: 64px;
}

@container (min-width: 700px) {
	.dz-columns {
		grid-template-columns: minmax(0, 640px) minmax(0, 1fr);
		gap: 88px;
		align-items: start;
	}
}

.dz-schedule,
.dz-secondary {
	min-width: 0;
}

.dz-secondary section + section {
	margin-top: 56px;
}

/* ---------- Rows ---------- */

.dz-rows {
	list-style: none;
	margin: 0;
	padding: 0;
}

.dz-rows--allday {
	margin-bottom: 4px;
}

.dz-row {
	display: grid;
	grid-template-columns: 3.4em 1fr;
	column-gap: 14px;
	row-gap: 2px;
	padding: 13px 0;
	border-bottom: 1px solid rgba(232, 226, 214, 0.1);
}

.dz-row-time {
	font-family: "JetBrains Mono", monospace;
	font-variant-numeric: tabular-nums;
	font-size: 12px;
	color: #8b93a3;
	white-space: nowrap;
	padding-top: 2px;
}

.dz-row-title {
	font-size: 15px;
	color: #e8e2d6;
}

.dz-row.is-done .dz-row-title {
	color: #6c7382;
	text-decoration: line-through;
	text-decoration-color: rgba(108, 115, 130, 0.6);
}

.dz-row.is-overdue .dz-row-title,
.dz-row.is-overdue .dz-row-time {
	color: #d99a4e;
}

.dz-row-flag {
	font-family: "JetBrains Mono", monospace;
	font-size: 9.5px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #d99a4e;
	border: 1px solid rgba(217, 154, 78, 0.5);
	border-radius: 2px;
	padding: 1px 5px;
	margin-left: 8px;
	white-space: nowrap;
	vertical-align: middle;
}

.dz-row-meta {
	grid-column: 2;
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.02em;
	color: #6c7382;
}

/* ---------- In brief ---------- */

.dz-brief {
	list-style: none;
	margin: 0;
	padding: 0;
}

.dz-brief-item a {
	display: block;
	padding: 14px 0;
	border-bottom: 1px solid rgba(232, 226, 214, 0.1);
}

.dz-brief-head {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	margin-bottom: 6px;
}

.dz-brief-name {
	color: #cdd4de;
}

.dz-brief-days {
	font-variant-numeric: tabular-nums;
	color: #8b93a3;
	white-space: nowrap;
}

.dz-brief-item.is-slip .dz-brief-days {
	color: #d99a4e;
}

.dz-brief-action {
	font-size: 14px;
	color: #e8e2d6;
}

/* ---------- Routines ---------- */

.dz-routine-bucket {
	margin-bottom: 18px;
}

.dz-bucket-label {
	font-family: "JetBrains Mono", monospace;
	font-size: 10px;
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: #6c7382;
	margin: 0 0 6px;
}

.dz-routines {
	list-style: none;
	margin: 0;
	padding: 0;
}

.dz-routine-row {
	display: flex;
	align-items: baseline;
	gap: 10px;
	padding: 6px 0;
	font-size: 14px;
}

.dz-routine-check {
	font-family: "JetBrains Mono", monospace;
	color: #8b93a3;
	width: 1em;
}

.dz-routine-row.is-done .dz-routine-check {
	color: #7c9473;
}

.dz-routine-name {
	flex: 1;
	color: #cdd4de;
}

.dz-routine-row.is-done .dz-routine-name {
	color: #6c7382;
	text-decoration: line-through;
	text-decoration-color: rgba(108, 115, 130, 0.6);
}

.dz-routine-streak {
	font-family: "JetBrains Mono", monospace;
	font-variant-numeric: tabular-nums;
	font-size: 11px;
	color: #6c7382;
	white-space: nowrap;
}

/* ---------- Projects ---------- */

.dz-projects {
	list-style: none;
	margin: 0;
	padding: 0;
}

.dz-project-row {
	padding: 14px 0;
	border-bottom: 1px solid rgba(232, 226, 214, 0.1);
}

.dz-project-head {
	display: flex;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 8px;
	font-size: 14px;
}

.dz-project-name {
	color: #e8e2d6;
}

.dz-project-pct {
	font-family: "JetBrains Mono", monospace;
	font-variant-numeric: tabular-nums;
	color: #8b93a3;
}

.dz-project-bar {
	height: 2px;
	background: rgba(232, 226, 214, 0.12);
	margin-bottom: 8px;
}

.dz-project-bar-fill {
	display: block;
	height: 100%;
	background: #b9c3d1;
}

.dz-project-next {
	font-size: 13px;
	color: #8b93a3;
	margin: 0;
}

/* ---------- Pull quotes ---------- */

.dz-pullquote {
	margin: 0;
	padding: 20px 0;
	border-top: 1px solid rgba(232, 226, 214, 0.16);
	border-bottom: 1px solid rgba(232, 226, 214, 0.16);
}

.dz-pullquote p {
	font-family: "Newsreader", serif;
	font-style: italic;
	font-size: 1.15rem;
	line-height: 1.5;
	color: #f4efe4;
	margin: 0 0 10px;
}

.dz-pullquote p::before {
	content: "\\201C";
}

.dz-pullquote p::after {
	content: "\\201D";
}

.dz-pullquote footer {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.04em;
	color: #8b93a3;
}

.dz-pullquote--minor {
	padding: 16px 0;
}

.dz-pullquote--minor p {
	font-size: 1rem;
}

.dz-quote-controls {
	display: flex;
	align-items: center;
	gap: 10px;
	margin: 14px 0 0;
}

.dz-quote-skips {
	font-family: "JetBrains Mono", monospace;
	font-size: 10.5px;
	color: #6c7382;
	white-space: nowrap;
}

/* ---------- Capture ---------- */

.dz-capture {
	max-width: 720px;
	margin: 88px auto 0;
	text-align: center;
}

.dz-capture-chips {
	list-style: none;
	margin: 0 0 16px;
	padding: 0;
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 10px 18px;
}

.dz-capture-chip {
	font-family: "JetBrains Mono", monospace;
	font-size: 11px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #b9c3d1;
	border-bottom: 1px solid rgba(232, 226, 214, 0.3);
	padding-bottom: 2px;
	white-space: nowrap;
}

.dz-capture-hint {
	font-size: 13px;
	color: #6c7382;
	margin: 0;
}

@media (prefers-reduced-motion: reduce) {
	.dz-nightdesk * {
		animation: none !important;
		transition: none !important;
	}
}
`;
