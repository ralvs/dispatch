"use client";

import { useState } from "react";
import type { CompareDay } from "../mock";

// ---------------------------------------------------------------------------
// Icons — 16px inline SVGs, stroke="currentColor", strokeWidth 1.5, no fill.
// ---------------------------------------------------------------------------

type IconProps = { className?: string };

function IconBell({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M4 6a4 4 0 0 1 8 0c0 3 1 4 1 4H3s1-1 1-4Z" />
			<path d="M6.5 12.5a1.5 1.5 0 0 0 3 0" />
		</svg>
	);
}

function IconMessage({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M2 3.5h12v7H6l-2.5 2.5V10.5H2Z" />
		</svg>
	);
}

function IconCalendar({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<rect x="2.5" y="3.5" width="11" height="10" rx="0.5" />
			<path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
		</svg>
	);
}

function IconClock({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="8" cy="8" r="5.5" />
			<path d="M8 5v3l2 1.5" />
		</svg>
	);
}

function IconInbox({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<circle cx="8" cy="8" r="5.5" strokeDasharray="2 2.4" />
		</svg>
	);
}

function IconStar({ className, filled }: IconProps & { filled?: boolean }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill={filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M8 2.2 9.7 6l4.1.4-3.1 2.8.9 4-3.6-2.1-3.6 2.1.9-4L2.2 6.4 6.3 6Z" />
		</svg>
	);
}

function IconFlame({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M8 1.7s3.4 3 3.4 6.1a3.4 3.4 0 0 1-6.8 0c0-1 .5-1.8 1-2.4 0 1 .6 1.5 1.1 1.5.7 0 .8-.8.6-1.5-.3-1-.1-2.3.7-3.7Z" />
		</svg>
	);
}

function IconAlertTriangle({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M8 2.2 14.3 13H1.7Z" />
			<path d="M8 6.5v3M8 11.5h.01" />
		</svg>
	);
}

function IconFolder({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M2 4.5h4l1.2 1.5H14v6.5H2Z" />
		</svg>
	);
}

function IconQuote({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M3 9V6.5A2.5 2.5 0 0 1 5.5 4M3 9h2.2v3H3Z" />
			<path d="M9.7 9V6.5A2.5 2.5 0 0 1 12.2 4M9.7 9h2.2v3H9.7Z" />
		</svg>
	);
}

function IconMic({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<rect x="6" y="1.7" width="4" height="7" rx="2" />
			<path d="M4 7.5a4 4 0 0 0 8 0M8 11.5V14M6 14h4" />
		</svg>
	);
}

function IconArrowRight({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M2.5 8h11M9.5 4l4 4-4 4" />
		</svg>
	);
}

function IconCheck({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.75"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<path d="M3 8.5 6.3 12 13 4" />
		</svg>
	);
}

// ---------------------------------------------------------------------------
// Checkbox — real <input type="checkbox">, visually hidden, styled sibling.
// ---------------------------------------------------------------------------

function Checkbox({
	id,
	checked,
	onToggle,
	label,
}: {
	id: string;
	checked: boolean;
	onToggle: () => void;
	label: string;
}) {
	return (
		<label htmlFor={id} className="dzl3-check-wrap flex shrink-0 cursor-pointer items-center">
			<input
				id={id}
				type="checkbox"
				checked={checked}
				onChange={onToggle}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className="flex h-4 w-4 items-center justify-center border border-line-strong text-success transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
			>
				{checked && <IconCheck className="h-3 w-3" />}
			</span>
			<span className="sr-only">{label}</span>
		</label>
	);
}

// ---------------------------------------------------------------------------
// Day tape geometry
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
.dzl3-tape {
	position: relative;
	padding-top: 46px;
	padding-bottom: 34px;
}

.dzl3-axis {
	position: relative;
	height: 2px;
	background: var(--line);
}

.dzl3-tick {
	position: absolute;
	top: -3px;
	width: 1px;
	height: 8px;
	background: var(--line-strong);
}

.dzl3-tick-label {
	position: absolute;
	top: 10px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
	letter-spacing: 0.04em;
	color: var(--ink-3);
	white-space: nowrap;
}

.dzl3-now {
	position: absolute;
	top: -28px;
	width: 2px;
	height: 38px;
	background: var(--accent);
	transform: translateX(-1px);
}

.dzl3-now-label {
	position: absolute;
	top: -42px;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 10px;
	font-weight: 600;
	color: var(--accent-ink);
	white-space: nowrap;
}

.dzl3-flag-stem {
	position: absolute;
	width: 1px;
	background: var(--line);
}

.dzl3-flag-stem.tier-up {
	bottom: 2px;
	height: 14px;
}

.dzl3-flag-stem.tier-down {
	top: 2px;
	height: 14px;
}

.dzl3-flag-dot {
	position: absolute;
	top: 0;
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: var(--ink-3);
	transform: translate(-50%, -50%);
}

.dzl3-flag-dot.is-top3 {
	background: var(--warning);
}

.dzl3-flag-dot.is-overdue {
	background: var(--warning);
}

.dzl3-flag-dot.is-done {
	background: var(--success);
}

.dzl3-flag-label {
	position: absolute;
	transform: translateX(-50%);
	font-family: var(--font-mono);
	font-size: 9px;
	color: var(--ink-3);
	white-space: nowrap;
}

.dzl3-flag-label.tier-up {
	bottom: 18px;
}

.dzl3-flag-label.tier-down {
	top: 18px;
}

.dzl3-flag-title {
	display: none;
}

@container (min-width: 48rem) {
	.dzl3-tape {
		padding-top: 42px;
		padding-bottom: 52px;
	}

	.dzl3-flag-title {
		display: inline;
		color: var(--ink-2);
	}

	/* Clamp so same-tier neighbours (09:00 / 13:00) never touch. */
	.dzl3-flag-label {
		max-width: 150px;
		overflow: hidden;
		text-overflow: ellipsis;
	}
}
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LedgerDesign({ day }: { day: CompareDay }) {
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

	return (
		<div className="dzl3 bg-bg text-ink">
			<style>{TAPE_CSS}</style>
			<div className="mx-auto max-w-[1180px] px-4 py-10 @3xl:px-10">
				<header className="hairline flex flex-wrap items-baseline justify-between gap-3 pb-5">
					<div>
						<p className="font-serif text-xl">{day.dateline}</p>
						<p className="mt-1 flex flex-wrap items-center gap-3 font-mono text-meta text-ink-3">
							<span>{day.weekday}</span>
							<span>ISO wk {day.isoWeek}</span>
							<span>{day.timezone}</span>
						</p>
					</div>
					<div className="flex items-center gap-4">
						<a
							href="/notifications"
							className="flex items-center gap-1.5 font-mono text-meta text-ink-2 hover:text-ink"
						>
							<IconBell className="text-ink-3" />
							<span className="tabular-nums">{day.unreadNotifications}</span>
							<span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
						</a>
						<a
							href="/chat"
							className="flex items-center gap-1.5 font-mono text-meta text-accent-ink hover:text-accent"
						>
							<IconMessage />
							Ask
						</a>
					</div>
				</header>

				<div className="grid grid-cols-1 gap-14 @3xl:grid-cols-[1.6fr_1fr] @3xl:items-start @3xl:gap-14">
					{/* ------------------------------------------------------------ */}
					{/* Main reading column                                          */}
					{/* ------------------------------------------------------------ */}
					<div className="min-w-0">
						<section aria-label="Anchor summary" className="pt-8">
							<p className="text-eyebrow uppercase text-ink-3">
								{day.anchor.eventCount === 1 ? "1 event" : `${day.anchor.eventCount} events`} today
							</p>
							<p className="mt-2 font-serif text-lg leading-snug">
								Next up at <span className="tabular-nums">{day.anchor.nextEvent.time}</span>
								{" — "}
								{day.anchor.nextEvent.title}.
							</p>
							<p className="mt-2 font-mono text-meta text-ink-3">
								<span className="tabular-nums">{day.anchor.openCount}</span> open{" "}
								<span aria-hidden="true">·</span>{" "}
								<span className="tabular-nums text-warning">{day.anchor.overdueCount}</span> overdue
							</p>
						</section>

						<section aria-label="Cadence" className="mt-14">
							<div className="hairline-strong grid grid-cols-2 pb-2 @3xl:grid-cols-5">
								{day.cadence.map((c) => (
									<a
										key={c.key}
										href={c.href}
										className="border-line border-t py-3 pr-3 first:border-t-0 @3xl:border-t-0 @3xl:border-l @3xl:pl-4 @3xl:first:border-l-0"
									>
										<span
											className={
												c.slip
													? "block font-serif text-2xl tabular-nums text-warning"
													: "block font-serif text-2xl tabular-nums"
											}
										>
											{c.big}
										</span>
										<span className="mt-1 block text-eyebrow uppercase text-ink-3">{c.label}</span>
									</a>
								))}
							</div>
						</section>

						<section aria-label="Day tape" className="mt-14">
							<h2 className="hairline-strong flex items-center gap-2 pb-2 text-eyebrow uppercase text-ink-2">
								<IconClock className="text-ink-3" />
								Day tape
							</h2>
							<div className="dzl3-tape mt-2">
								<div className="dzl3-axis">
									{TAPE_TICKS.map((h) => (
										<div key={h} className="dzl3-tick" style={{ left: `${tapePct(h * 60)}%` }} />
									))}
									{TAPE_TICKS.map((h) => (
										<div
											key={`l-${h}`}
											className="dzl3-tick-label"
											style={{ left: `${tapePct(h * 60)}%` }}
										>
											{String(h).padStart(2, "0")}:00
										</div>
									))}
									{timelineFlags.map((item) => {
										const left = tapePct(toMinutes(item.time));
										const isDone = checked[item.key];
										const dotClass = isDone
											? "dzl3-flag-dot is-done"
											: item.top3
												? "dzl3-flag-dot is-top3"
												: "dzl3-flag-dot";
										return (
											<div key={item.key}>
												<div
													className={`dzl3-flag-stem ${item.tier}`}
													style={{ left: `${left}%` }}
												/>
												<div className={dotClass} style={{ left: `${left}%` }} />
												<div
													className={`dzl3-flag-label ${item.tier}`}
													style={{ left: `${left}%` }}
												>
													{item.time}
													{item.top3 && !isDone && (
														<IconStar
															filled
															className="ml-0.5 inline h-2.5 w-2.5 align-middle text-warning"
														/>
													)}
													<span className="dzl3-flag-title"> · {item.title}</span>
												</div>
											</div>
										);
									})}
									<div className="dzl3-now" style={{ left: `${tapePct(nowMinutes)}%` }} />
									<div className="dzl3-now-label" style={{ left: `${tapePct(nowMinutes)}%` }}>
										now {day.nowLabel}
									</div>
								</div>
							</div>
						</section>

						<section aria-label="Day schedule" className="mt-14">
							<h2 className="hairline-strong pb-2 text-eyebrow uppercase text-ink-2">Schedule</h2>

							<div className="mt-6">
								<h3 className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-3">
									<IconCalendar />
									All day
								</h3>
								<ul className="mt-2 flex flex-col gap-2">
									{day.schedule.allDay.map((item) => {
										const isDone = checked[item.key];
										const isTask = item.kind === "task";
										return (
											<li key={item.key} className="flex items-center gap-3 bg-surface px-3 py-2.5">
												{isTask ? (
													<Checkbox
														id={`chk-${item.key}`}
														checked={isDone}
														onToggle={() => toggle(item.key)}
														label={`Mark "${item.title}" done`}
													/>
												) : (
													<IconCalendar className="shrink-0 text-ink-3" />
												)}
												<span className="flex-1">
													<span className={isDone ? "text-ink-3 line-through" : "text-ink"}>
														{item.title}
													</span>
													<span className="ml-2 font-mono text-meta text-ink-3">{item.meta}</span>
												</span>
												{item.top3 && <IconStar filled className="shrink-0 text-warning" />}
											</li>
										);
									})}
								</ul>
							</div>

							<div className="mt-9">
								<h3 className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-3">
									<IconClock />
									Timeline
								</h3>
								<ul className="mt-2">
									{day.schedule.timeline.map((item) => {
										const isDone = checked[item.key];
										const isTask = item.kind === "task";
										return (
											<li
												key={item.key}
												className="hairline grid grid-cols-[3.4rem_auto_1fr] items-start gap-3 py-2.5"
											>
												<span className="whitespace-nowrap pt-0.5 font-mono text-meta tabular-nums text-ink-3">
													{item.time}
												</span>
												{isTask ? (
													<Checkbox
														id={`chk-${item.key}`}
														checked={isDone}
														onToggle={() => toggle(item.key)}
														label={`Mark "${item.title}" done`}
													/>
												) : (
													<IconCalendar className="mt-0.5 shrink-0 text-ink-3" />
												)}
												<span>
													<span className="flex items-center gap-1.5">
														<span className={isDone ? "text-ink-3 line-through" : "text-ink"}>
															{item.title}
														</span>
														{item.top3 && <IconStar filled className="shrink-0 text-warning" />}
													</span>
													<span className="mt-0.5 block font-mono text-meta text-ink-3">
														{item.meta}
													</span>
												</span>
											</li>
										);
									})}
								</ul>
							</div>

							<div className="mt-9">
								<h3 className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-3">
									<IconInbox />
									Open
								</h3>
								<ul className="mt-2">
									{day.schedule.open.map((item) => {
										const isDone = checked[item.key];
										return (
											<li key={item.key} className="hairline flex items-start gap-3 py-2.5">
												<Checkbox
													id={`chk-${item.key}`}
													checked={isDone}
													onToggle={() => toggle(item.key)}
													label={`Mark "${item.title}" done`}
												/>
												<span className="flex-1">
													<span className="flex items-center gap-1.5">
														<span className={isDone ? "text-ink-3 line-through" : "text-ink"}>
															{item.title}
														</span>
														{item.top3 && <IconStar filled className="shrink-0 text-warning" />}
													</span>
													<span
														className={
															item.overdue && !isDone
																? "mt-0.5 block font-mono text-meta text-warning"
																: "mt-0.5 block font-mono text-meta text-ink-3"
														}
													>
														{item.meta}
													</span>
												</span>
											</li>
										);
									})}
								</ul>
							</div>
						</section>

						<section aria-label="In brief" className="mt-14">
							<h2 className="hairline-strong pb-2 text-eyebrow uppercase text-ink-2">In brief</h2>
							<ul>
								{day.brief.map((b) => {
									const over = b.daysSince >= b.thresholdDays;
									const fillPct = Math.min((b.daysSince / (b.thresholdDays * 1.4)) * 100, 100);
									return (
										<li key={b.key} className="hairline py-4">
											<a href={b.href} className="group block">
												<div className="flex items-baseline justify-between gap-3">
													<span className="font-serif text-base">{b.name}</span>
													<span
														className={
															over
																? "whitespace-nowrap font-mono text-lg tabular-nums text-warning"
																: "whitespace-nowrap font-mono text-lg tabular-nums"
														}
													>
														{b.daysSince}
														<span className="ml-1.5 font-sans text-meta font-normal text-ink-3">
															{b.unit}
														</span>
													</span>
												</div>
												<div className="mt-2.5 h-1 w-full bg-surface-2">
													<div
														className={over ? "h-full bg-warning" : "h-full bg-ink-4"}
														style={{ width: `${fillPct}%` }}
													/>
												</div>
												<div className="mt-2.5 flex items-center gap-1.5 text-ink-2">
													<span>{b.nextAction}</span>
													<IconArrowRight className="shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
												</div>
											</a>
										</li>
									);
								})}
							</ul>
						</section>
					</div>

					{/* ------------------------------------------------------------ */}
					{/* Secondary rail                                               */}
					{/* ------------------------------------------------------------ */}
					<aside className="min-w-0 pt-8">
						<section aria-label="Alerts awaiting decision">
							<h2 className="hairline-strong flex items-center gap-2 pb-2 text-eyebrow uppercase text-ink-2">
								<IconAlertTriangle className="text-warning" />
								Awaiting decision
							</h2>
							<ul>
								{day.alerts.map((a) => (
									<li key={a.key} className="hairline">
										<a href={a.href} className="flex items-center justify-between gap-3 py-3">
											<span className="flex items-center gap-2">
												<span className="font-mono tabular-nums text-warning">{a.count}</span>
												<span className="text-ink-2">{a.label}</span>
											</span>
											<IconArrowRight className="shrink-0 text-ink-3" />
										</a>
									</li>
								))}
							</ul>
						</section>

						<section aria-label="Routines" className="mt-14">
							<h2 className="hairline-strong flex items-center justify-between pb-2 text-eyebrow uppercase text-ink-2">
								<span>Routines</span>
								<span className="font-mono tabular-nums text-ink-3">
									{routinesDone}/{routineRows.length} done
								</span>
							</h2>
							{day.routines.buckets.map((bucket) => (
								<div key={bucket.bucket} className="mt-5">
									<p className="text-eyebrow uppercase text-ink-3">{bucket.bucket}</p>
									<ul className="mt-1.5">
										{bucket.rows.map((r) => {
											const isDone = checked[r.id];
											return (
												<li key={r.id} className="hairline flex items-center gap-3 py-2">
													<Checkbox
														id={`chk-${r.id}`}
														checked={isDone}
														onToggle={() => toggle(r.id)}
														label={`Mark "${r.name}" done`}
													/>
													<span
														className={
															isDone ? "flex-1 text-ink-3 line-through" : "flex-1 text-ink"
														}
													>
														{r.name}
													</span>
													<span className="flex items-center gap-1 whitespace-nowrap font-mono text-meta text-ink-3">
														{r.time && <span className="tabular-nums">{r.time}</span>}
														<IconFlame className="text-warning" />
														<span className="tabular-nums">{r.streak}d</span>
													</span>
												</li>
											);
										})}
									</ul>
								</div>
							))}
						</section>

						<section aria-label="Projects" className="mt-14">
							<h2 className="hairline-strong flex items-center gap-2 pb-2 text-eyebrow uppercase text-ink-2">
								<IconFolder className="text-ink-3" />
								Projects
							</h2>
							<ul>
								{day.projects.map((p) => (
									<li key={p.id} className="hairline py-3.5">
										<div className="flex items-baseline justify-between gap-3">
											<span className="font-serif text-sm">{p.name}</span>
											<span className="font-mono text-meta tabular-nums text-ink-2">
												{Math.round(p.progress * 100)}%
											</span>
										</div>
										<div className="mt-2 h-1 w-full bg-surface-2">
											<div className="h-full bg-accent" style={{ width: `${p.progress * 100}%` }} />
										</div>
										<a
											href={`/projects/${p.id}`}
											className="mt-2 flex items-center gap-1.5 text-meta text-ink-3 hover:text-ink-2"
										>
											<span>Next: {p.nextMilestone}</span>
											<IconArrowRight className="shrink-0" />
										</a>
									</li>
								))}
							</ul>
						</section>

						<section aria-label="Quotes" className="mt-14">
							<h2 className="hairline-strong flex items-center gap-2 pb-2 text-eyebrow uppercase text-ink-2">
								<IconQuote className="text-ink-3" />
								Quotes
							</h2>
							<div className="mt-4">
								<p className="text-eyebrow uppercase text-ink-3">Resurfaced</p>
								<blockquote className="mt-2 font-serif text-base italic leading-snug">
									&ldquo;{day.resurfaced.text}&rdquo;
								</blockquote>
								<p className="mt-2 font-mono text-meta text-ink-3">
									{day.resurfaced.author}
									{day.resurfaced.reference ? ` · ${day.resurfaced.reference}` : ""}
								</p>
								<div className="mt-2.5 flex items-center gap-4">
									<button
										type="button"
										className="font-mono text-meta uppercase tracking-wide text-accent-ink hover:text-accent"
									>
										Next
									</button>
									<button
										type="button"
										className="font-mono text-meta uppercase tracking-wide text-accent-ink hover:text-accent"
									>
										Reset
									</button>
									<span className="font-mono text-meta text-ink-4">
										skipped {day.resurfaced.skips}×
									</span>
								</div>
							</div>
							<div className="hairline mt-6 pt-6">
								<p className="text-eyebrow uppercase text-ink-3">Latest</p>
								<blockquote className="mt-2 font-serif text-sm italic leading-snug">
									&ldquo;{day.latestQuote.text}&rdquo;
								</blockquote>
								<p className="mt-2 font-mono text-meta text-ink-3">
									{day.latestQuote.author}
									{day.latestQuote.reference ? ` · ${day.latestQuote.reference}` : ""}
								</p>
							</div>
						</section>

						<section aria-label="Capture" className="mt-14">
							<h2 className="hairline-strong flex items-center gap-2 pb-2 text-eyebrow uppercase text-ink-2">
								<IconMic className="text-ink-3" />
								Capture
							</h2>
							<div className="mt-4 flex flex-wrap gap-2">
								{day.capture.map((c) => (
									<button
										key={c}
										type="button"
										className="rounded-full border border-line px-3.5 py-1.5 text-meta text-ink-2 hover:border-line-strong"
									>
										{c}
									</button>
								))}
							</div>
							<p className="mt-4 flex items-center gap-1.5 text-meta text-ink-3">
								<IconMic className="shrink-0" />
								Hold the mic to capture a thought, task, or note.
							</p>
						</section>
					</aside>
				</div>
			</div>
		</div>
	);
}
