"use client";

import { useState } from "react";
import type { CompareDay } from "../mock";

// ---------------------------------------------------------------------------
// Jared's UI — the reference implementation (jerad-ops) reproduced verbatim.
//
// This is the "editorial newspaper" identity Dispatch shipped with and then
// drifted away from (editorial → ElevenLabs → Vercel Geist; see ADR-0013).
// It is here on /compare so the two directions can be judged side by side.
//
// The whole subtree is scoped under `.jared`, which re-binds the app's own
// design-token CSS variables (--bg, --ink, --accent, …) to jerad-ops's warm
// linen + rust palette. That means the app's existing utility classes
// (text-ink, bg-surface, text-accent, border-line, …) render in Jared's
// colors here without touching the global theme. Serif goes through a scoped
// `.jserif` class (font-family only) so it doesn't inherit the app's Geist
// display weights.
//
// Tokens lifted verbatim from jerad-ops/apps/web/tailwind.config.ts.
// ---------------------------------------------------------------------------

const JARED_CSS = `
.jared {
	--bg: #F6F2EA;
	--surface: #FBF8F2;
	--surface-2: #EFEAE0;
	--ink: #1A1612;
	--ink-2: #5A544B;
	--ink-3: #928A7E;
	--ink-4: #B8B0A2;
	--line: rgba(26, 22, 18, 0.08);
	--line-strong: rgba(26, 22, 18, 0.16);
	--accent: #B8442B;
	--accent-bg: rgba(184, 68, 43, 0.08);
	--accent-ink: #8A3320;
	--accent-slip: #9C3F26;
	--font-serif: "Newsreader", Georgia, "Times New Roman", ui-serif, serif;
	background: var(--bg);
	color: var(--ink);
	color-scheme: light;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.jared ::selection {
	background: rgba(184, 68, 43, 0.22);
}

/* Serif = family only, so Tailwind weight/tracking utilities govern (the
 * app's own .font-serif would force Geist 600 + tight tracking). */
.jared .jserif {
	font-family: var(--font-serif);
}

/* jerad-ops globals.css — standalone hairline dividers (the app's own
 * .hairline is a border-bottom; re-declare here at higher specificity). */
.jared .hairline {
	display: block;
	height: 1px;
	width: 100%;
	background: var(--line);
	border: 0;
}
.jared .hairline-strong {
	display: block;
	height: 1px;
	width: 100%;
	background: var(--line-strong);
	border: 0;
}

/* Editorial briefing-line wash. */
.jared .brief-clickable {
	margin: 0 -10px;
	padding-left: 10px;
	padding-right: 10px;
	transition: background 0.12s;
}
.jared .brief-clickable:hover {
	background: rgba(26, 22, 18, 0.035);
}
.jared .brief-clickable:active {
	background: rgba(26, 22, 18, 0.06);
}
`;

const MONTHS: Record<string, string> = {
	Jan: "January",
	Feb: "February",
	Mar: "March",
	Apr: "April",
	May: "May",
	Jun: "June",
	Jul: "July",
	Aug: "August",
	Sep: "September",
	Oct: "October",
	Nov: "November",
	Dec: "December",
};

function formatClock(time: string): string {
	const [h, m] = time.split(":").map(Number);
	const period = h < 12 ? "AM" : "PM";
	const display = h === 0 ? 12 : h <= 12 ? h : h - 12;
	return `${display}:${String(m).padStart(2, "0")} ${period}`;
}

// ---------------------------------------------------------------------------
// Frame — the jerad-ops (authed) main: capped, centered, editorial padding.
// `lg:` breakpoints become `@3xl` container variants so the two-column grid
// keys off the /compare frame width, not the viewport.
// ---------------------------------------------------------------------------

function JaredFrame({ children }: { children: React.ReactNode }) {
	return (
		<div className="jared font-sans">
			<style>{JARED_CSS}</style>
			<div className="mx-auto w-full max-w-[1280px] px-5 pb-16 pt-6 @3xl:px-10">{children}</div>
		</div>
	);
}

function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return (
		<div className={`font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 ${className}`}>
			{children}
		</div>
	);
}

// ---------------------------------------------------------------------------
// CadenceBar — brief-line.tsx, ratio form. Neutral fill to the cadence tick,
// rust overflow past it.
// ---------------------------------------------------------------------------

function CadenceBar({ ratio }: { ratio: number }) {
	const overdue = ratio > 1;
	const expectedFrac = overdue ? 1 / ratio : 1;
	const fillFrac = overdue ? 1 : ratio;
	return (
		<div className="relative mt-0.5 h-[3px] bg-line-strong">
			<div
				className="absolute left-0 top-0 h-full bg-ink-3"
				style={{ width: `${Math.min(expectedFrac, fillFrac) * 100}%` }}
			/>
			{overdue && (
				<div
					className="absolute top-0 h-full bg-accent"
					style={{ left: `${expectedFrac * 100}%`, width: `${(1 - expectedFrac) * 100}%` }}
				/>
			)}
			<div
				className="absolute -top-[2px] h-[7px] w-px bg-ink-2"
				style={{ left: `${expectedFrac * 100}%` }}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Rail task row — TaskItem.tsx: 5×5 checkbox, title link, project/due meta,
// Top-3 star. Wired to local state instead of server actions.
// ---------------------------------------------------------------------------

type RailTask = {
	id: string;
	title: string;
	project: string;
	dueText: string | null;
	dueKind: "overdue" | "today" | "future";
	top3: boolean;
};

function RailTaskRow({
	task,
	done,
	starred,
	onToggleDone,
	onToggleStar,
}: {
	task: RailTask;
	done: boolean;
	starred: boolean;
	onToggleDone: () => void;
	onToggleStar: () => void;
}) {
	return (
		<div className="group flex items-start gap-3 py-2">
			<button
				type="button"
				onClick={onToggleDone}
				aria-label={done ? "Mark task open" : "Mark task done"}
				className={`flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
					done ? "border-ink-2 bg-ink-2" : "border-line hover:border-ink-2"
				}`}
			>
				{done && (
					<svg viewBox="0 0 16 16" className="h-3 w-3 text-bg" aria-hidden="true">
						<path
							d="M3 8l3 3 7-7"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</button>

			<div className="min-w-0 flex-1">
				<p
					className={`text-[14px] leading-snug transition-colors ${
						done ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink"
					}`}
				>
					{task.title}
				</p>
				{!done && (
					<div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
						<span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
							{task.project}
						</span>
						{task.dueText && (
							<span
								className={`font-mono text-[10px] uppercase tracking-wider ${
									task.dueKind === "overdue"
										? "text-accent"
										: task.dueKind === "today"
											? "text-ink-2"
											: "text-ink-3"
								}`}
							>
								{task.dueText}
							</span>
						)}
					</div>
				)}
			</div>

			<button
				type="button"
				onClick={onToggleStar}
				aria-label={starred ? "Remove from Top 3" : "Add to Top 3"}
				className={`pt-0.5 text-[16px] leading-none transition-colors ${
					starred ? "text-accent" : "text-ink-3 opacity-0 hover:text-ink-2 group-hover:opacity-100"
				}`}
			>
				{starred ? "★" : "☆"}
			</button>
		</div>
	);
}

// Turn the shared mock's schedule into the "Doing today" rail: starred,
// overdue, and due-today tasks — the same shape TaskItem consumes.
function buildRail(day: CompareDay): RailTask[] {
	type Src = { key: string; title: string; meta: string; top3: boolean; overdue?: boolean };
	const rows: (RailTask & { rank: number })[] = [];

	function push(src: Src, dueToday: boolean) {
		const overdue = Boolean(src.overdue);
		if (!src.top3 && !overdue && !dueToday) return;
		const project = src.meta.split("·")[0]?.trim() ?? "";
		const overdueMatch = src.meta.match(/overdue\s+(\d+d)/i);
		const dueText = overdue
			? `Overdue ${overdueMatch?.[1] ?? ""}`.trim()
			: dueToday
				? "Due today"
				: null;
		const dueKind: RailTask["dueKind"] = overdue ? "overdue" : dueToday ? "today" : "future";
		const rank = src.top3 ? 0 : overdue ? 1 : 2;
		rows.push({ id: src.key, title: src.title, project, dueText, dueKind, top3: src.top3, rank });
	}

	for (const i of day.schedule.allDay) if (i.kind === "task") push(i, /due today/i.test(i.meta));
	for (const i of day.schedule.timeline) if (i.kind === "task") push(i, true);
	for (const i of day.schedule.open) push(i, false);

	return rows.sort((a, b) => a.rank - b.rank).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Today — "The Briefing" (jerad-ops today/page.tsx).
// ---------------------------------------------------------------------------

export function JaredTodayDesign({ day }: { day: CompareDay }) {
	const rail = buildRail(day);
	const routineRows = day.routines.buckets.flatMap((b) =>
		b.rows.map((r) => ({ ...r, bucket: b.bucket })),
	);

	const initial: Record<string, boolean> = {};
	for (const t of rail) initial[t.id] = false;
	for (const r of routineRows) initial[r.id] = r.done;
	const [done, setDone] = useState(initial);

	const initialStars: Record<string, boolean> = {};
	for (const t of rail) initialStars[t.id] = t.top3;
	const [stars, setStars] = useState(initialStars);

	const toggleDone = (id: string) => setDone((p) => ({ ...p, [id]: !p[id] }));
	const toggleStar = (id: string) => setStars((p) => ({ ...p, [id]: !p[id] }));

	const routinesDone = routineRows.filter((r) => done[r.id]).length;

	const [, dayNum, monthAbbr] = day.dateline.split(" ");
	const weekdayAbbr = day.weekday.slice(0, 3).toUpperCase();
	const meta = `${weekdayAbbr} · ${monthAbbr.toUpperCase()} ${dayNum} · WEEK ${day.isoWeek}`;
	const longDay = `${day.weekday}, ${MONTHS[monthAbbr] ?? monthAbbr} ${dayNum}`;

	const triage = day.alerts.find((a) => a.key === "triage");

	return (
		<JaredFrame>
			{/* ─── Masthead ─────────────────────────────────────────── */}
			<div className="flex items-baseline justify-between gap-3">
				<div>
					<div className="mb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
						{meta}
					</div>
					<h1 className="jserif text-[26px] font-semibold leading-none tracking-[-0.5px] text-ink">
						The Briefing
					</h1>
				</div>
				<a
					href="/notifications"
					aria-label={`${day.unreadNotifications} unread notifications`}
					className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 transition-colors hover:text-ink-2"
				>
					{day.unreadNotifications > 0 && (
						<span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
					)}
					<span>{day.unreadNotifications}</span>
				</a>
			</div>
			<div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
				{longDay}
			</div>
			<div className="hairline-strong mt-3" />

			{/* ─── Commitments anchor line ──────────────────────────── */}
			<p className="mt-3 text-[12px] leading-snug text-ink-2">
				<span className="hover:text-ink">
					{day.anchor.eventCount} events today — next{" "}
					<span className="font-mono tabular-nums text-ink-2">{day.anchor.nextEvent.time}</span>{" "}
					{day.anchor.nextEvent.title}.
				</span>{" "}
				<span className="hover:text-ink">
					{day.anchor.openCount} tasks open
					{day.anchor.overdueCount > 0 && (
						<span className="text-accent"> · {day.anchor.overdueCount} overdue</span>
					)}
					.
				</span>
			</p>

			{/* ─── Inbox triage strip ───────────────────────────────── */}
			{triage && triage.count > 0 && (
				<a
					href={triage.href}
					className="mt-5 flex items-baseline justify-between gap-3 border-l-2 border-accent py-2 pl-3 transition-colors hover:bg-accent/[0.04]"
				>
					<div>
						<div className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
							Inbox
						</div>
						<div className="mt-0.5 text-[13px] text-ink">
							{triage.count} {triage.count === 1 ? "task needs" : "tasks need"} a home.
						</div>
					</div>
					<span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-accent">
						Triage →
					</span>
				</a>
			)}

			{/* ─── Two-column editorial grid ────────────────────────── */}
			<div className="mt-7 @3xl:grid @3xl:grid-cols-[1.5fr_1fr] @3xl:items-start @3xl:gap-x-10">
				{/* Left: editorial body */}
				<div>
					<section>
						<Eyebrow className="mb-3">In brief</Eyebrow>
						{day.brief.map((line) => {
							const ratio = line.daysSince / line.thresholdDays;
							return (
								<a
									key={line.key}
									href={line.href}
									className="brief-clickable block border-b border-line py-4"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="min-w-0 flex-1">
											<h3 className="jserif text-[18px] font-medium leading-tight tracking-[-0.2px] text-ink">
												{line.name}
											</h3>
										</div>
										<div className="flex shrink-0 items-baseline gap-1.5 text-right">
											<span
												className={`jserif text-[34px] font-medium leading-[0.9] tabular-nums tracking-[-1px] ${
													line.slipping ? "text-accent-slip" : "text-ink"
												}`}
											>
												{line.daysSince}
											</span>
										</div>
									</div>
									<div className="-mt-0.5 mb-2 flex justify-end">
										<span className="text-[11px] text-ink-3">{line.unit}</span>
									</div>
									<CadenceBar ratio={ratio} />
									<div className="mt-3 flex flex-wrap items-center gap-2">
										<span className="font-mono text-[9px] uppercase tracking-[0.06em] text-ink-3">
											Next
										</span>
										<span className="min-w-0 flex-1 text-[13px] text-ink-2">{line.nextAction}</span>
									</div>
									<div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-accent">
										Open {line.name} →
									</div>
								</a>
							);
						})}
					</section>

					{/* Resurfaced */}
					<section className="mt-9 border-y border-line bg-surface px-5 py-6">
						<Eyebrow className="mb-3">Resurfaced</Eyebrow>
						<blockquote className="jserif text-[19px] italic leading-snug text-ink">
							&ldquo;{day.resurfaced.text}&rdquo;
						</blockquote>
						<div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
							— {day.resurfaced.author}
							{day.resurfaced.reference ? ` · ${day.resurfaced.reference}` : ""}
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-4">
							<a
								href="/quotes"
								className="font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:text-accent-ink"
							>
								Open in Quotes →
							</a>
							<button
								type="button"
								className="font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
							>
								Next →
							</button>
							{day.resurfaced.skips > 0 && (
								<button
									type="button"
									className="font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
									title={`${day.resurfaced.skips} skipped today`}
								>
									Reset
								</button>
							)}
						</div>
					</section>

					{/* Latest quote */}
					<section className="mt-6 border border-line px-5 py-5">
						<Eyebrow className="mb-3">Latest quote</Eyebrow>
						<blockquote className="jserif text-[17px] italic leading-snug text-ink">
							&ldquo;{day.latestQuote.text}&rdquo;
						</blockquote>
						<div className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-3">
							— {day.latestQuote.author}
							{day.latestQuote.reference ? ` · ${day.latestQuote.reference}` : ""}
						</div>
						<div className="mt-3 flex flex-wrap items-center gap-4">
							<a
								href="/quotes"
								className="font-mono text-[10px] uppercase tracking-wider text-accent transition-colors hover:text-accent-ink"
							>
								Open quote →
							</a>
						</div>
					</section>
				</div>

				{/* Right: commitments rail */}
				<div className="mt-9 @3xl:mt-0">
					{/* Today: events */}
					<section>
						<div className="mb-3 flex items-baseline justify-between">
							<Eyebrow>
								Today · {day.anchor.eventCount} {day.anchor.eventCount === 1 ? "event" : "events"}
							</Eyebrow>
							<a
								href="/today"
								className="font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
							>
								Open →
							</a>
						</div>
						<a
							href="/today"
							className="flex items-baseline gap-4 border-b border-line py-1.5 transition-opacity hover:opacity-80"
						>
							<span className="w-12 shrink-0 font-mono text-[12px] tabular-nums text-ink">
								{day.anchor.nextEvent.time}
							</span>
							<span className="truncate text-[13px] text-ink-2">{day.anchor.nextEvent.title}</span>
						</a>
						{day.anchor.eventCount > 1 && (
							<a
								href="/today"
								className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
							>
								+ {day.anchor.eventCount - 1} more →
							</a>
						)}
					</section>

					{/* Doing today */}
					<section className="mt-6">
						<div className="mb-1 flex items-baseline justify-between">
							<Eyebrow>
								Doing · {day.anchor.openCount} open
								{day.anchor.overdueCount > 0 && (
									<span className="ml-1 text-accent">· {day.anchor.overdueCount} overdue</span>
								)}
							</Eyebrow>
							<a
								href="/tasks"
								className="font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
							>
								All tasks →
							</a>
						</div>
						<div className="mt-1">
							{rail.map((t) => (
								<RailTaskRow
									key={t.id}
									task={t}
									done={done[t.id]}
									starred={stars[t.id]}
									onToggleDone={() => toggleDone(t.id)}
									onToggleStar={() => toggleStar(t.id)}
								/>
							))}
						</div>
					</section>

					{/* Routines */}
					<section className="mt-7">
						<div className="mb-3 flex items-baseline justify-between">
							<Eyebrow>
								Routines · {routinesDone} of {routineRows.length} today
							</Eyebrow>
							<a
								href="/routines"
								className="font-mono text-[10px] uppercase tracking-wider text-ink-3 transition-colors hover:text-accent"
							>
								All →
							</a>
						</div>
						<div className="space-y-3">
							{day.routines.buckets.map((bucket) => (
								<div key={bucket.bucket}>
									<div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
										{bucket.bucket}
									</div>
									<ul className="space-y-1">
										{bucket.rows.map((r) => {
											const isDone = done[r.id];
											return (
												<li key={r.id} className="flex items-center gap-3 py-1">
													<button
														type="button"
														onClick={() => toggleDone(r.id)}
														aria-label={isDone ? `Uncheck ${r.name}` : `Check off ${r.name}`}
														className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 transition-colors ${
															isDone
																? "border-ink bg-ink text-bg"
																: "border-line hover:border-ink-2"
														}`}
													>
														{isDone && (
															<svg
																viewBox="0 0 16 16"
																className="h-3 w-3"
																fill="none"
																stroke="currentColor"
																strokeWidth="2.5"
																aria-hidden="true"
															>
																<path
																	d="M3 8l3 3 7-7"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																/>
															</svg>
														)}
													</button>
													<span
														className={`flex min-w-0 flex-1 items-baseline gap-2 text-[13px] ${
															isDone ? "text-ink-3 line-through decoration-ink-3/60" : "text-ink"
														}`}
													>
														<span className="truncate">{r.name}</span>
														{r.time && (
															<span
																className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
																	isDone ? "text-ink-3" : "text-ink-2"
																}`}
															>
																{formatClock(r.time)}
															</span>
														)}
													</span>
													{r.streak > 0 ? (
														<span
															className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
																isDone ? "text-accent" : "text-ink-3"
															}`}
														>
															🔥 {r.streak}
														</span>
													) : (
														<span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-3">
															—
														</span>
													)}
												</li>
											);
										})}
									</ul>
								</div>
							))}
						</div>
					</section>
				</div>
			</div>

			{/* ─── Capture chips ────────────────────────────────────── */}
			<section className="mt-9">
				<Eyebrow className="mb-2">Capture</Eyebrow>
				<div className="flex flex-wrap items-center gap-2">
					{day.capture.map((label) => (
						<button
							key={label}
							type="button"
							className="whitespace-nowrap border border-line px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
						>
							{label}
						</button>
					))}
					<span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-ink-3">
						— or hold the mic.
					</span>
				</div>
			</section>
		</JaredFrame>
	);
}

// ---------------------------------------------------------------------------
// Tasks — the full list reached from "Doing today" (jerad-ops tasks/page.tsx).
// Filter tabs, editorial groups, priority dots, collapsible "Completed today".
// ---------------------------------------------------------------------------

type Filter = "all" | "today" | "upcoming" | "project";
const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "today", label: "Today" },
	{ value: "upcoming", label: "Upcoming" },
	{ value: "project", label: "Project" },
];

type ListTask = {
	id: string;
	title: string;
	project: string;
	priority: 1 | 2 | 3 | 4;
	dueText: string | null;
	dueKind: "overdue" | "today" | "future" | null;
	bucket: "overdue" | "today" | "upcoming" | "nodate";
	flags: { label: string; accent?: boolean }[];
};

// A coherent task set drawn from the shared mock's vocabulary, shaped the way
// jerad-ops's Task model feeds the list (project, priority, due, flags).
const TASKS: ListTask[] = [
	{
		id: "k1",
		title: "Reply to the landlord about the inspection",
		project: "Home",
		priority: 2,
		dueText: "07/17",
		dueKind: "overdue",
		bucket: "overdue",
		flags: [],
	},
	{
		id: "k2",
		title: "Book the dentist",
		project: "Health",
		priority: 3,
		dueText: "07/19",
		dueKind: "overdue",
		bucket: "overdue",
		flags: [{ label: "remind −1d" }],
	},
	{
		id: "k3",
		title: "Send the Casa Verde deposit",
		project: "Money",
		priority: 1,
		dueText: "today",
		dueKind: "today",
		bucket: "today",
		flags: [],
	},
	{
		id: "k4",
		title: "Draft the ingest ADR",
		project: "Dispatch",
		priority: 1,
		dueText: "today",
		dueKind: "today",
		bucket: "today",
		flags: [{ label: "linked content", accent: true }],
	},
	{
		id: "k5",
		title: "Sign the Casa Verde contract",
		project: "Money",
		priority: 2,
		dueText: "07/25",
		dueKind: "future",
		bucket: "upcoming",
		flags: [],
	},
	{
		id: "k6",
		title: "Pick a photographer for the trip",
		project: "Travel",
		priority: 3,
		dueText: "07/28",
		dueKind: "future",
		bucket: "upcoming",
		flags: [],
	},
	{
		id: "k7",
		title: "Outline the Portugal itinerary",
		project: "Travel",
		priority: 4,
		dueText: null,
		dueKind: null,
		bucket: "nodate",
		flags: [{ label: "repeats weekly" }],
	},
	{
		id: "k8",
		title: "Read 20 pages of Bird by Bird",
		project: "(no project)",
		priority: 4,
		dueText: null,
		dueKind: null,
		bucket: "nodate",
		flags: [],
	},
];

const COMPLETED = [{ id: "c1", title: "Review the migration plan", time: "09:12" }];

function priorityClass(p: number): string {
	if (p === 1) return "bg-accent";
	if (p === 2) return "bg-ink-2";
	if (p === 3) return "bg-ink-3";
	return "bg-ink-4";
}

function ListTaskRow({
	task,
	showProject,
	done,
	onToggle,
}: {
	task: ListTask;
	showProject: boolean;
	done: boolean;
	onToggle: () => void;
}) {
	return (
		<div className="flex items-start gap-3 border-b border-line py-3">
			<button
				type="button"
				onClick={onToggle}
				aria-label="Toggle done"
				className={`mt-0.5 block h-4 w-4 shrink-0 border transition-colors ${
					done ? "border-ink-3 bg-ink-3" : "border-ink-3 hover:border-ink"
				}`}
			>
				{done && (
					<svg viewBox="0 0 12 12" className="h-full w-full text-bg" aria-hidden="true">
						<path
							d="M2 6l3 3 5-6"
							stroke="currentColor"
							strokeWidth="1.6"
							fill="none"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				)}
			</button>

			<div className="min-w-0 flex-1">
				<div
					className={`text-[14px] font-medium leading-snug ${
						done ? "text-ink-3 line-through decoration-ink-4" : "text-ink"
					}`}
				>
					{task.title}
				</div>
				<div className="mt-1 flex flex-wrap items-center gap-2">
					{showProject && <span className="text-[11px] text-ink-3">{task.project}</span>}
					{task.flags.map((f) => (
						<span
							key={f.label}
							className={`bg-surface-2 px-1.5 py-px font-mono text-[9px] tracking-[0.05em] ${
								f.accent ? "text-accent" : "text-ink-3"
							}`}
						>
							{f.label}
						</span>
					))}
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2.5 pt-0.5">
				{task.dueText && (
					<span
						className={`font-mono text-[10px] tabular-nums ${
							task.dueKind === "overdue" ? "text-accent" : "text-ink-3"
						}`}
					>
						{task.dueText}
					</span>
				)}
				<span
					role="img"
					aria-label={`priority ${task.priority}`}
					className={`h-1.5 w-1.5 rounded-full ${priorityClass(task.priority)}`}
				/>
			</div>
		</div>
	);
}

export function JaredTasksDesign(_props: { day: CompareDay }) {
	const [filter, setFilter] = useState<Filter>("all");
	const [done, setDone] = useState<Record<string, boolean>>({});
	const [showCompleted, setShowCompleted] = useState(false);

	const toggle = (id: string) => setDone((p) => ({ ...p, [id]: !p[id] }));

	const open = TASKS;
	const counts = {
		open: open.length,
		overdue: open.filter((t) => t.bucket === "overdue").length,
		today: open.filter((t) => t.bucket === "today").length,
	};

	type Group = { label: string; tasks: ListTask[]; accent?: boolean; showProject: boolean };
	let groups: Group[] = [];
	if (filter === "all") {
		groups = [
			{
				label: "Overdue",
				tasks: open.filter((t) => t.bucket === "overdue"),
				accent: true,
				showProject: true,
			},
			{ label: "Today", tasks: open.filter((t) => t.bucket === "today"), showProject: true },
			{ label: "Upcoming", tasks: open.filter((t) => t.bucket === "upcoming"), showProject: true },
			{ label: "No date", tasks: open.filter((t) => t.bucket === "nodate"), showProject: true },
		];
	} else if (filter === "today") {
		groups = [
			{
				label: "Overdue",
				tasks: open.filter((t) => t.bucket === "overdue"),
				accent: true,
				showProject: true,
			},
			{ label: "Today", tasks: open.filter((t) => t.bucket === "today"), showProject: true },
		];
	} else if (filter === "upcoming") {
		groups = [
			{ label: "Upcoming", tasks: open.filter((t) => t.bucket === "upcoming"), showProject: true },
		];
	} else {
		const byProject = new Map<string, ListTask[]>();
		for (const t of open) {
			const list = byProject.get(t.project) ?? [];
			list.push(t);
			byProject.set(t.project, list);
		}
		groups = Array.from(byProject.entries())
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([label, tasks]) => ({ label, tasks, showProject: false }));
	}

	return (
		<JaredFrame>
			{/* ─── Breadcrumb + masthead ────────────────────────────── */}
			<a
				href="/today"
				className="mb-2 flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3 transition-colors hover:text-ink-2"
			>
				<span className="h-[5px] w-[5px] rounded-full bg-accent" aria-hidden />
				From Today · Doing
			</a>
			<h1 className="jserif text-[28px] font-medium leading-none tracking-[-0.4px] text-ink">
				Tasks
			</h1>
			<div className="mt-1.5 text-[12px] text-ink-3">
				{counts.open} open · {counts.overdue} overdue · {counts.today} today
			</div>

			{/* ─── Filter tabs ──────────────────────────────────────── */}
			<div className="mt-4 flex items-center gap-5">
				{FILTERS.map((f) => {
					const active = filter === f.value;
					return (
						<button
							key={f.value}
							type="button"
							onClick={() => setFilter(f.value)}
							className={`pb-1 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
								active
									? "border-b border-ink text-ink"
									: "border-b border-transparent text-ink-3 hover:text-ink-2"
							}`}
						>
							{f.label}
						</button>
					);
				})}
			</div>

			<div className="hairline mt-3" />

			{/* ─── Groups ───────────────────────────────────────────── */}
			<div className="mt-5">
				{groups.every((g) => g.tasks.length === 0) ? (
					<p className="text-[13px] italic text-ink-3">Nothing in this view.</p>
				) : (
					groups.map((g) =>
						g.tasks.length > 0 ? (
							<div key={g.label} className="mb-6">
								<div className="mb-2 flex items-baseline justify-between">
									<span
										className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
											g.accent ? "text-accent" : "text-ink-3"
										}`}
									>
										{g.label}
									</span>
									<span className="font-mono text-[10px] text-ink-3">{g.tasks.length}</span>
								</div>
								{g.tasks.map((t) => (
									<ListTaskRow
										key={t.id}
										task={t}
										showProject={g.showProject}
										done={Boolean(done[t.id])}
										onToggle={() => toggle(t.id)}
									/>
								))}
							</div>
						) : null,
					)
				)}
			</div>

			{/* ─── Completed today (collapsible) ────────────────────── */}
			<div className="mt-6 border-t border-line-strong pt-4">
				<button
					type="button"
					onClick={() => setShowCompleted((s) => !s)}
					className="flex w-full items-center justify-between"
				>
					<span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-3">
						Completed today
					</span>
					<span className="font-mono text-[10px] text-ink-3">
						{COMPLETED.length}{" "}
						<span
							className={`inline-block transition-transform ${showCompleted ? "rotate-90" : ""}`}
							aria-hidden
						>
							▸
						</span>
					</span>
				</button>
				{showCompleted && (
					<div className="mt-3">
						{COMPLETED.map((t) => (
							<div key={t.id} className="flex items-center gap-3 border-b border-line/60 py-2">
								<span className="flex h-4 w-4 shrink-0 items-center justify-center border border-ink-3 bg-ink-3">
									<svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-bg" aria-hidden="true">
										<path
											d="M2 6l3 3 5-6"
											stroke="currentColor"
											strokeWidth="1.6"
											fill="none"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</span>
								<span className="min-w-0 flex-1 truncate text-[13px] text-ink-3 line-through decoration-ink-4">
									{t.title}
								</span>
								<span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-4">
									{t.time}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			{/* ─── Footer add ───────────────────────────────────────── */}
			<div className="mt-10">
				<a
					href="/tasks"
					className="block border border-dashed border-line-strong px-4 py-3 text-center text-[13px] text-ink-2 transition-colors hover:border-ink-2 hover:text-ink"
				>
					+ Add task <span className="text-ink-3">— or hold the mic</span>
				</a>
			</div>
		</JaredFrame>
	);
}
