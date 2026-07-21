"use client";

import { useState } from "react";
import type { CompareDay } from "../mock";

// ---------------------------------------------------------------------------
// Day tape geometry — ported verbatim from ledger.tsx (defect classes already
// solved there: label collision, tier separation, mobile title clamp).
// ---------------------------------------------------------------------------

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
.dzcur-tape {
	position: relative;
	padding-top: 64px;
	padding-bottom: 52px;
}

.dzcur-axis {
	position: relative;
	height: 2px;
	background: var(--line);
}

.dzcur-tick {
	position: absolute;
	top: -3px;
	width: 1px;
	height: 8px;
	background: var(--line-strong);
}

.dzcur-tick-label {
	position: absolute;
	top: 10px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
	letter-spacing: 0.04em;
	color: var(--ink-3);
	white-space: nowrap;
}

.dzcur-now {
	position: absolute;
	top: -46px;
	width: 2px;
	height: 56px;
	z-index: 0;
	background: var(--accent);
	transform: translateX(-1px);
}

.dzcur-now-label {
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

.dzcur-flag-stem {
	position: absolute;
	width: 1px;
	background: var(--line);
}

.dzcur-flag-stem.tier-up {
	bottom: 2px;
	height: 14px;
}

.dzcur-flag-stem.tier-down {
	top: 2px;
	height: 14px;
}

.dzcur-flag-dot {
	position: absolute;
	top: 0;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--ink-3);
	transform: translate(-50%, -50%);
}

.dzcur-flag-dot.is-top3 {
	background: var(--warning);
}

.dzcur-flag-dot.is-done {
	background: var(--success);
}

.dzcur-flag-label {
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

.dzcur-flag-label.tier-up {
	bottom: 18px;
}

.dzcur-flag-label.tier-down {
	top: 32px;
}

.dzcur-flag-title {
	display: none;
}

@container (min-width: 48rem) {
	.dzcur-tape {
		padding-top: 64px;
		padding-bottom: 58px;
	}

	.dzcur-flag-title {
		display: inline;
		color: var(--ink-2);
	}

	.dzcur-flag-label {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}
`;

// ---------------------------------------------------------------------------
// CadenceBar — cadence-bar.tsx ported verbatim (pure divs, no SVG).
// ---------------------------------------------------------------------------

function CadenceBar({ daysSince, thresholdDays }: { daysSince: number; thresholdDays: number }) {
	const span = Math.max(thresholdDays * 2, daysSince, 1);
	const shown = Math.min(daysSince, span);
	const neutralPct = (Math.min(shown, thresholdDays) / span) * 100;
	const overflowPct = (Math.max(shown - thresholdDays, 0) / span) * 100;
	const tickPct = (thresholdDays / span) * 100;

	return (
		<div className="relative mt-2 h-[3px] w-full bg-line-strong" aria-hidden>
			<div className="absolute left-0 top-0 h-full bg-ink-3" style={{ width: `${neutralPct}%` }} />
			<div
				className="gradient-ship absolute top-0 h-full"
				style={{ left: `${neutralPct}%`, width: `${overflowPct}%` }}
			/>
			<div className="absolute top-[-2px] h-[7px] w-px bg-ink-2" style={{ left: `${tickPct}%` }} />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Band — the day-schedule.tsx band wrapper, verbatim class strings.
// ---------------------------------------------------------------------------

function Band({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="mt-8">
			<h3 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">{title}</h3>
			<ul className="mt-1">{children}</ul>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Task row — task-row.tsx's checkbox + title + meta + ☆ visual language,
// wired to local state instead of server actions.
// ---------------------------------------------------------------------------

type TaskLikeItem = {
	key: string;
	title: string;
	meta: string;
	top3: boolean;
	done: boolean;
	time?: string;
	overdue?: boolean;
};

function TaskRow({
	item,
	checked,
	onToggle,
}: {
	item: TaskLikeItem;
	checked: boolean;
	onToggle: () => void;
}) {
	const scheduled = item.time !== undefined;

	return (
		<li className="hairline flex items-baseline gap-3 py-3">
			{scheduled && (
				<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
					{item.time}
				</span>
			)}
			<input
				type="checkbox"
				checked={checked}
				aria-label={checked ? `Reopen "${item.title}"` : `Complete "${item.title}"`}
				onChange={onToggle}
				className={`h-4 w-4 shrink-0 appearance-none self-center border ${
					checked ? "border-ink-4 bg-ink-4" : "border-line-strong hover:border-ink-3"
				}`}
			/>
			<div className="min-w-0 flex-1">
				<p className={`text-sm ${checked ? "text-ink-4 line-through" : "text-ink"}`}>
					{item.title}
				</p>
				<p
					className={`mt-0.5 font-mono text-meta ${
						item.overdue && !checked ? "text-accent-slip" : "text-ink-4"
					}`}
				>
					{item.meta}
				</p>
			</div>
			<button
				type="button"
				aria-label={item.top3 ? "Remove from today's top 3" : "Pin to today's top 3"}
				aria-pressed={item.top3}
				disabled={checked}
				className={`self-center text-base leading-none ${
					item.top3 ? "text-accent" : "text-ink-4 hover:text-ink-2"
				} ${checked ? "invisible" : ""}`}
			>
				{item.top3 ? "★" : "☆"}
			</button>
		</li>
	);
}

function EventRow({ item }: { item: { title: string; meta: string; time?: string } }) {
	return (
		<li className="hairline flex items-baseline gap-3 py-3">
			<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
				{item.time ?? "—"}
			</span>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm text-ink">{item.title}</p>
				{item.meta && <p className="mt-0.5 truncate font-mono text-meta text-ink-4">{item.meta}</p>}
			</div>
			<span className="shrink-0 self-center font-mono text-eyebrow uppercase tracking-widest text-ink-4">
				Event
			</span>
		</li>
	);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CurrentDesign({ day }: { day: CompareDay }) {
	const initialChecked: Record<string, boolean> = {};
	for (const item of day.schedule.allDay) initialChecked[item.key] = item.done;
	for (const item of day.schedule.timeline) initialChecked[item.key] = item.done;
	for (const item of day.schedule.open) initialChecked[item.key] = item.done;
	for (const bucket of day.routines.buckets) {
		for (const row of bucket.rows) initialChecked[row.id] = row.done;
	}

	const [checked, setChecked] = useState(initialChecked);

	function toggle(key: string) {
		setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
	}

	const routineRows = day.routines.buckets.flatMap((b) => b.rows);
	const routinesDone = routineRows.filter((r) => checked[r.id]).length;
	const nowMinutes = toMinutes(day.nowLabel);

	const timelineFlags = day.schedule.timeline.map((item, i) => ({
		...item,
		tier: i % 2 === 0 ? "tier-up" : "tier-down",
	}));

	const showLatestQuote = true;

	return (
		<div className="dzcur bg-bg text-ink">
			<style>{TAPE_CSS}</style>
			<div className="mx-auto max-w-[1180px] px-4 py-10 @3xl:px-10">
				{/* Masthead — masthead.tsx */}
				<header className="hairline-strong pb-5">
					<div className="flex items-baseline justify-between">
						<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							{day.dateline}
						</p>
						<div className="flex items-baseline gap-4">
							{day.unreadNotifications > 0 && (
								<a
									href="/notifications"
									className="flex items-baseline gap-1.5 font-mono text-meta text-ink-3 hover:text-ink-2"
								>
									<span aria-hidden className="inline-block h-1.5 w-1.5 self-center bg-accent" />
									{day.unreadNotifications}
									<span className="sr-only"> unread notifications</span>
								</a>
							)}
							<a href="/chat" className="font-mono text-meta text-ink-3 hover:text-ink-2">
								Ask →
							</a>
						</div>
					</div>
					<h1 className="display-tight gradient-text-mesh mt-1 w-fit font-serif text-4xl">
						Dispatch
					</h1>
					<p className="mt-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						{day.weekday}
					</p>
				</header>

				{/* Anchor line — anchor-line.tsx */}
				<p className="mt-12 text-xs text-ink-2">
					<span>
						{day.anchor.eventCount} event{day.anchor.eventCount === 1 ? "" : "s"} today
						{" — next "}
						{day.anchor.nextEvent.time} {day.anchor.nextEvent.title}
						{". "}
					</span>
					<a href="/tasks" className="hover:underline">
						{day.anchor.openCount} task{day.anchor.openCount === 1 ? "" : "s"} open
						{day.anchor.overdueCount > 0 && (
							<>
								{" · "}
								<span className="text-accent">{day.anchor.overdueCount} overdue</span>
							</>
						)}
						.
					</a>
				</p>

				{/* Cadence strip — cadence-strip.tsx */}
				<section className="mt-12" aria-label="Cadence">
					<ul className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
						{day.cadence.map((c) => (
							<li key={c.key}>
								<a href={c.href} className="block hover:opacity-80">
									<span
										className={`block font-serif text-[30px] leading-none tabular-nums ${
											c.slip ? "text-accent-slip" : "text-ink"
										}`}
									>
										{c.big}
									</span>
									<span className="mt-1.5 block font-mono text-eyebrow uppercase tracking-widest text-ink-3">
										{c.label}
									</span>
								</a>
							</li>
						))}
					</ul>
				</section>

				{/* Alerts row — alerts-row.tsx */}
				<section className="mt-12" aria-label="Alerts">
					<ul className="flex flex-wrap gap-2">
						{day.alerts.map((a) => (
							<li key={a.key}>
								<a
									href={a.href}
									className="flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink"
								>
									<span className="text-accent tabular-nums">{a.count}</span>
									{a.label}
								</a>
							</li>
						))}
					</ul>
				</section>

				{/* Day tape — full width, ported from ledger.tsx */}
				<section aria-label="Day tape" className="mt-14">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Day tape</h2>
					<div className="dzcur-tape mt-2">
						<div className="dzcur-axis">
							{TAPE_TICKS.map((h) => (
								<div key={h} className="dzcur-tick" style={{ left: `${tapePct(h * 60)}%` }} />
							))}
							{TAPE_TICKS.map((h) => (
								<div
									key={`l-${h}`}
									className="dzcur-tick-label"
									style={{ left: `${tapePct(h * 60)}%` }}
								>
									{String(h).padStart(2, "0")}:00
								</div>
							))}
							{timelineFlags.map((item) => {
								const left = tapePct(toMinutes(item.time));
								const isDone = checked[item.key];
								const dotClass = isDone
									? "dzcur-flag-dot is-done"
									: item.top3
										? "dzcur-flag-dot is-top3"
										: "dzcur-flag-dot";
								return (
									<div key={item.key}>
										<div className={`dzcur-flag-stem ${item.tier}`} style={{ left: `${left}%` }} />
										<div className={dotClass} style={{ left: `${left}%` }} />
										<div className={`dzcur-flag-label ${item.tier}`} style={{ left: `${left}%` }}>
											{item.time}
											{item.top3 && !isDone && <span className="text-warning"> ★</span>}
											<span className="dzcur-flag-title"> · {item.title}</span>
										</div>
									</div>
								);
							})}
							<div className="dzcur-now" style={{ left: `${tapePct(nowMinutes)}%` }} />
							<div className="dzcur-now-label" style={{ left: `${tapePct(nowMinutes)}%` }}>
								now {day.nowLabel}
							</div>
						</div>
					</div>
				</section>

				{/* Day schedule — day-schedule.tsx, full width */}
				<section className="mt-14" aria-label="Day schedule">
					<div className="flex items-baseline justify-between">
						<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							The day · {day.anchor.openCount} open
							{day.anchor.overdueCount > 0 && (
								<span className="text-accent"> · {day.anchor.overdueCount} overdue</span>
							)}
						</h2>
						<a href="/tasks" className="font-mono text-meta text-ink-4 hover:text-ink-2">
							All tasks →
						</a>
					</div>

					{day.schedule.allDay.length > 0 && (
						<Band title="All day">
							{day.schedule.allDay.map((item) =>
								item.kind === "task" ? (
									<TaskRow
										key={item.key}
										item={item}
										checked={checked[item.key]}
										onToggle={() => toggle(item.key)}
									/>
								) : (
									<EventRow key={item.key} item={item} />
								),
							)}
						</Band>
					)}

					{day.schedule.timeline.length > 0 && (
						<Band title="Timeline">
							{day.schedule.timeline.map((item) =>
								item.kind === "task" ? (
									<TaskRow
										key={item.key}
										item={item}
										checked={checked[item.key]}
										onToggle={() => toggle(item.key)}
									/>
								) : (
									<EventRow key={item.key} item={item} />
								),
							)}
						</Band>
					)}

					{day.schedule.open.length > 0 && (
						<Band title="Open">
							{day.schedule.open.map((item) => (
								<TaskRow
									key={item.key}
									item={item}
									checked={checked[item.key]}
									onToggle={() => toggle(item.key)}
								/>
							))}
						</Band>
					)}
				</section>

				<div className="mt-14 grid grid-cols-1 gap-14 @3xl:grid-cols-[1.5fr_1fr] @3xl:items-start @3xl:gap-x-10">
					<div className="min-w-0">
						{/* In brief — compact, per requirement 8 */}
						<section aria-label="In brief">
							<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
								In brief
							</h2>
							<ul>
								{day.brief.map((b) => (
									<li key={b.key} className="hairline flex items-center gap-4 py-3">
										<span className="w-20 shrink-0 truncate font-serif text-sm text-ink">
											{b.name}
										</span>
										<span
											className={`shrink-0 whitespace-nowrap font-serif text-lg leading-none tabular-nums ${
												b.slipping ? "text-accent-slip" : "text-ink"
											}`}
										>
											{b.daysSince}
											<span className="ml-1 font-sans text-meta font-normal text-ink-3">
												{b.unit}
											</span>
										</span>
										<span className="min-w-[4rem] flex-1">
											<CadenceBar daysSince={b.daysSince} thresholdDays={b.thresholdDays} />
										</span>
										<span className="hidden min-w-0 flex-[1.4] truncate text-meta text-ink-2 @3xl:block">
											{b.nextAction}
										</span>
									</li>
								))}
							</ul>
						</section>

						{/* Resurfaced quote — resurfaced-quote.tsx */}
						<section
							className="mt-12 rounded-xl border border-line bg-surface px-5 py-6"
							aria-label="Resurfaced"
						>
							<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
								Resurfaced
							</h2>
							<blockquote className="mt-3 font-serif text-[19px] italic leading-snug text-ink">
								“{day.resurfaced.text}”
							</blockquote>
							<p className="mt-2 font-mono text-meta text-ink-3">
								{day.resurfaced.author}
								{day.resurfaced.reference ? ` · ${day.resurfaced.reference}` : ""}
							</p>
							<div className="mt-4 flex items-baseline gap-5 font-mono text-meta">
								<a href="/quotes" className="text-ink-3 hover:text-ink-2">
									Open in Quotes →
								</a>
								<button type="button" className="text-ink-3 hover:text-ink-2">
									Next →
								</button>
								{day.resurfaced.skips > 0 && (
									<button type="button" className="text-ink-4 hover:text-ink-2">
										Reset
									</button>
								)}
							</div>
						</section>

						{/* Latest quote — latest-quote.tsx */}
						{showLatestQuote && (
							<section
								className="mt-8 rounded-xl border border-line px-5 py-5"
								aria-label="Latest quote"
							>
								<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
									Latest quote
								</h2>
								<blockquote className="mt-3 font-serif text-[17px] italic leading-snug text-ink">
									“{day.latestQuote.text}”
								</blockquote>
								<p className="mt-2 font-mono text-meta text-ink-3">
									{day.latestQuote.author}
									{day.latestQuote.reference ? ` · ${day.latestQuote.reference}` : ""}
								</p>
								<p className="mt-4 font-mono text-meta">
									<a href="/quotes" className="text-ink-3 hover:text-ink-2">
										Open quote →
									</a>
								</p>
							</section>
						)}
					</div>

					<div className="min-w-0">
						{/* Routines — routines-card.tsx + routine-check-row.tsx */}
						<section aria-label="Routines today">
							<div className="flex items-baseline justify-between">
								<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
									Routines · {routinesDone} of {routineRows.length} today
								</h2>
								<a href="/routines" className="font-mono text-meta text-ink-4 hover:text-ink-2">
									All →
								</a>
							</div>
							{day.routines.buckets.map((bucket) => (
								<div key={bucket.bucket} className="mt-6">
									<h3 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
										{bucket.bucket}
									</h3>
									<ul className="mt-1">
										{bucket.rows.map((r) => {
											const isDone = checked[r.id];
											return (
												<li
													key={r.id}
													className="flex items-baseline gap-3 border-b border-line py-3"
												>
													<input
														type="checkbox"
														checked={isDone}
														aria-label={isDone ? `Undo "${r.name}"` : `Complete "${r.name}"`}
														onChange={() => toggle(r.id)}
														className={`h-4 w-4 shrink-0 appearance-none self-center border ${
															isDone
																? "border-ink-4 bg-ink-4"
																: "border-line-strong hover:border-ink-3"
														}`}
													/>
													<span
														className={`min-w-0 flex-1 text-sm ${
															isDone ? "text-ink-4 line-through" : "text-ink"
														}`}
													>
														{r.name}
													</span>
													{r.time && (
														<span className="font-mono text-meta tabular-nums text-ink-4">
															{r.time}
														</span>
													)}
													{r.streak > 1 && (
														<span className="font-mono text-meta text-ink-3">🔥 {r.streak}</span>
													)}
												</li>
											);
										})}
									</ul>
								</div>
							))}
						</section>

						{/* Projects — projects-card.tsx */}
						<section className="mt-12" aria-label="Active projects">
							<div className="flex items-baseline justify-between">
								<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
									Projects · {day.projects.length} active
								</h2>
								<a href="/projects" className="font-mono text-meta text-ink-4 hover:text-ink-2">
									All →
								</a>
							</div>
							<ul className="mt-2">
								{day.projects.map((p) => (
									<li key={p.id} className="border-b border-line py-3.5">
										<a href={`/projects/${p.id}`} className="block">
											<div className="flex items-baseline justify-between gap-3">
												<span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
												<span className="font-mono text-meta tabular-nums text-ink-3">
													{Math.round(p.progress * 100)}%
												</span>
											</div>
											{p.nextMilestone && (
												<p className="mt-0.5 truncate font-mono text-meta text-ink-4">
													Next · {p.nextMilestone}
												</p>
											)}
										</a>
									</li>
								))}
							</ul>
						</section>
					</div>
				</div>
			</div>
		</div>
	);
}
