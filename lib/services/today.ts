import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
	dateOfInstant,
	formatInstant,
	instantFromLocal,
	isoWeek,
	isWallClockTime,
	shiftDay,
} from "@/lib/dates";
import { computeRoutineStats, type RoutineStats } from "@/lib/routine-stats";
import { type CalendarEventRow, listEventsOn } from "@/lib/services/calendar";
import { type DomainRow, listDomains } from "@/lib/services/domains";
import { unreadLinkCount } from "@/lib/services/links";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { countNeedsReview } from "@/lib/services/notes";
import { unreadCount } from "@/lib/services/notifications";
import {
	listMilestonesForProjects,
	listProjects,
	type MilestoneRow,
	milestoneProgress,
	type ProjectRow,
} from "@/lib/services/projects";
import { listQuotes, type QuoteRow } from "@/lib/services/quotes";
import { listSkippedToday } from "@/lib/services/resurfacing";
import {
	type CompletionRow,
	listCompletionsOn,
	listCompletionsSince,
	listRoutines,
	type RoutineRow,
} from "@/lib/services/routines";
import {
	lastCompletedByDomain,
	listCompletedOn,
	listTasks,
	type TaskRow,
} from "@/lib/services/tasks";
import { isDueToday, isOverdue, isTop3Today } from "@/lib/task-predicates";

// ─────────────────────────────────────────────────────────────────────────
// The Today page's data. getToday assembles a single read of the day's
// shape — masthead, anchor, brief lines, doing-today, routines, quotes, and
// at-a-glance widgets — from the underlying services. The pure helpers below
// are unit-tested in isolation; the fetcher composes them.
//
// Vocabulary (docs/adr/0036). The prefix tells you what a name follows:
//
//   Today*  is locked to the real calendar today.
//     TodayView    — everything the page renders (digest + today's schedule)
//     TodayDigest  — the cold half: quotes, projects, routines, cadence,
//                    alert counts. Cross-request cached (lib/cache/today.ts).
//
//   Day*    follows the date picker (`?d=`), so it is not necessarily today.
//     DaySchedule  — tasks + events for ONE date, in four bands
//                    (All day / Timeline / Top 3 / Open)
//     DayView      — the UI region that owns day navigation
//     DayBands     — the four lists; DayTape the ruler; DayNav the chevrons
//
// "Brief" is narrower than all of these: BriefLine / BriefSection are the
// "In brief" cadence rows, one section among many.
// ─────────────────────────────────────────────────────────────────────────

export type CadenceLine = {
	key: string;
	big: string;
	label: string;
	href: string;
	slip?: boolean;
};

/** One "In brief" row: a domain measured against its expected cadence. */
export type BriefLine = {
	key: string;
	name: string;
	color: string | null;
	daysSince: number;
	thresholdDays: number;
	slipping: boolean;
	unit: string;
	nextAction: string;
	href: string;
	/** Formatted display date of the last touch, or null when never touched. */
	lastTouched: string | null;
};

export type AnchorData = {
	eventCount: number;
	nextEvent: { startAt: string; title: string } | null;
	openCount: number;
	overdueCount: number;
};

export type RoutineBucketRow = {
	id: string;
	name: string;
	done: boolean;
	streak: number;
	specificTime: string | null;
	reminderEnabled: boolean;
	missed: boolean;
};

export type RoutineBucket = {
	bucket: RoutineRow["time_of_day"];
	rows: RoutineBucketRow[];
};

export type ProjectBrief = {
	id: string;
	name: string;
	progress: number;
	nextMilestone: { title: string } | null;
};

export type TodayView = {
	cadence: CadenceLine[];
	// Counts Today's alerts row reads: tasks with no domain, notes the parser
	// could not place, links not yet read.
	inboxCount: number;
	needsReviewCount: number;
	linksUnreadCount: number;
	// doingToday predates daySchedule and still feeds the widget payload
	// (app/api/widget/route.ts) and chat context — keep it until those callers
	// migrate. Today itself reads daySchedule.
	doingToday: TaskRow[];
	daySchedule: DaySchedule;
	routines: { total: number; done: number; remainingNames: string[] };
	quoteOfDay: QuoteRow | null;
	masthead: { isoWeek: number; unreadNotifications: number };
	anchor: AnchorData;
	briefLines: BriefLine[];
	routineBuckets: RoutineBucket[];
	resurfaced: QuoteRow | null;
	resurfacedSkips: number;
	latestQuote: QuoteRow | null;
	projects: ProjectBrief[];
};

/**
 * djb2 hash of a string, further mixed with the murmur3 finalizer (fmix32)
 * to spread bits before the modulo pick below — djb2 alone clusters low
 * bits for short, similar inputs like calendar dates.
 */
function hashSeed(str: string): number {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = (h * 33 + str.charCodeAt(i)) | 0;
	}
	h ^= h >>> 16;
	h = Math.imul(h, 0x85ebca6b);
	h ^= h >>> 13;
	h = Math.imul(h, 0xc2b2ae35);
	h ^= h >>> 16;
	return Math.abs(h);
}

/** Deterministic "quote of the day" — stable for a given date, spread across quotes. */
export function quoteOfDay(quotes: QuoteRow[], todayIso: string): QuoteRow | null {
	if (quotes.length === 0) return null;
	const sorted = [...quotes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const index = hashSeed(todayIso) % sorted.length;
	return sorted[index];
}

/**
 * Resurfaced pick honoring today's "Next →" skips: start at the daily hash
 * index, walk forward (wrapping) past skipped ids. Null when every quote has
 * been skipped — the UI renders the exhausted state and offers Reset.
 */
export function pickResurfaced(
	quotes: QuoteRow[],
	todayIso: string,
	skippedIds: readonly string[],
): QuoteRow | null {
	if (quotes.length === 0) return null;
	const skipped = new Set(skippedIds);
	const sorted = [...quotes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	const start = hashSeed(todayIso) % sorted.length;
	for (let i = 0; i < sorted.length; i++) {
		const candidate = sorted[(start + i) % sorted.length];
		if (!skipped.has(candidate.id)) return candidate;
	}
	return null;
}

/** The editorial cadence strip: a short row of counts, each linking to its section. */
export function buildCadenceLines(input: {
	overdue: number;
	dueToday: number;
	routinesDone: number;
	routinesTotal: number;
	needsReview: number;
}): CadenceLine[] {
	const lines: CadenceLine[] = [];

	if (input.overdue > 0) {
		lines.push({
			key: "overdue",
			big: String(input.overdue),
			label: "overdue",
			href: "/tasks",
			slip: true,
		});
	}

	if (input.dueToday > 0) {
		lines.push({
			key: "dueToday",
			big: String(input.dueToday),
			label: "due today",
			href: "/tasks",
		});
	}

	if (input.routinesTotal > 0) {
		lines.push({
			key: "routines",
			big: `${input.routinesDone}/${input.routinesTotal}`,
			label: "routines done",
			href: "/routines",
		});
	}

	if (input.needsReview > 0) {
		lines.push({
			key: "needsReview",
			big: String(input.needsReview),
			label: "need review",
			href: "/notes",
			slip: true,
		});
	}

	return lines;
}

/**
 * Doing today: today's starred top-3 first, then any other open task whose
 * due date has arrived, capped at 10. Ported verbatim from the Phase-1
 * derivation that used to live inline in app/(authed)/today/page.tsx.
 */
export function assembleDoingToday(open: TaskRow[], todayIso: string): TaskRow[] {
	const top3 = open.filter((t) => isTop3Today(t, todayIso));
	const dueOrOverdue = open.filter(
		(t) => !isTop3Today(t, todayIso) && t.due_date !== null && t.due_date <= todayIso,
	);
	return [...top3, ...dueOrOverdue].slice(0, 10);
}

// ─── Day schedule (ADR-0014) ────────────────────────────────────────────
//
// One "when is my day" composition instead of a flat events card beside a
// separate task card. Three bands:
//
//   allDay   all-day events + tasks due today with no time on them
//   timeline timed events and timed tasks merged, ascending by clock time
//   open     top-3 and other tasks that want attention but sit nowhere
//
// Ordering runs on UTC instants, never on formatted strings: an event that
// began yesterday and runs into today keeps its real start, and a task's
// wall-clock due_time is resolved through the app timezone
// (instantFromLocal) rather than compared as text. Ties break events before
// tasks, then by title, so the same input always yields the same order.

// `sortAt` is the UTC instant an item occupies on the timeline, and `time` its
// wall-clock rendering in the app timezone. All-day items have neither: they
// carry "" / null and order by kind then title inside their own band.
export type DayScheduleItem =
	| { kind: "event"; key: string; sortAt: string; time: string | null; event: CalendarEventRow }
	| { kind: "task"; key: string; sortAt: string; time: string | null; task: TaskRow };

export type DaySchedule = {
	allDay: DayScheduleItem[];
	timeline: DayScheduleItem[];
	/**
	 * Everything starred for today, whatever else it is. A starred task that
	 * also carries a due time deliberately appears here AND on the timeline:
	 * the timeline answers "when", this band answers "what matters". Dropping a
	 * task from it for having a clock time would misreport the day.
	 */
	top3: TaskRow[];
	open: TaskRow[];
};

/** Payload for client day-nav: schedule bands only, not the full Today digest. */
export type DaySchedulePayload = {
	schedule: DaySchedule;
	dateIso: string;
	nowUtcIso: string;
	nowLabel: string | null;
	eventNoteIds: Record<string, string>;
	taskNoteIds: Record<string, string>;
};

/** Cap on the open/unscheduled band — same ceiling assembleDoingToday used. */
const OPEN_CAP = 10;

/**
 * A task's due time as a UTC instant, or null when it has no usable one.
 * Defensive rather than throwing: a malformed time demotes the task to the
 * all-day band instead of taking the whole Today read down with it.
 */
function taskDueInstant(task: TaskRow, todayIso: string, tz: string): string | null {
	if (task.due_time === null || !isWallClockTime(task.due_time)) return null;
	try {
		return instantFromLocal(todayIso, task.due_time, tz);
	} catch {
		return null;
	}
}

function compareItems(a: DayScheduleItem, b: DayScheduleItem): number {
	if (a.sortAt !== b.sortAt) return a.sortAt < b.sortAt ? -1 : 1;
	if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
	const titleA = a.kind === "event" ? a.event.title : a.task.title;
	const titleB = b.kind === "event" ? b.event.title : b.task.title;
	return titleA < titleB ? -1 : titleA > titleB ? 1 : 0;
}

/**
 * `dateIso` is the day being shown, which is today only by default — Today's
 * day navigation composes the same bands for any date. Every rule below reads
 * off that date, so "due today", "starred for the day" and "already arrived"
 * stay true relative to the day on screen rather than to the wall clock.
 *
 * `completedTasks` are the tasks closed on that day (docs/adr/0038). They run
 * through exactly the same placement rules as the open ones, so a row ticked
 * off keeps the seat it had — the day is a record of what happened on it, not
 * only of what is left. Nothing is added that wasn't already on the day: a
 * completed task still has to be due by `dateIso` or starred for it to show.
 */
export function buildDaySchedule(input: {
	events: CalendarEventRow[];
	openTasks: TaskRow[];
	/** Tasks whose `completed_at` falls on `dateIso`. Optional — omitted by
	 * callers (tests, briefings) that only care about what is still open. */
	completedTasks?: TaskRow[];
	dateIso: string;
	tz: string;
}): DaySchedule {
	const { events, dateIso, tz } = input;
	// One list from here down: placement never asks whether a task is done,
	// only where it belongs on the day.
	const openTasks = [...input.openTasks, ...(input.completedTasks ?? [])];

	const allDay: DayScheduleItem[] = [];
	const timeline: DayScheduleItem[] = [];

	for (const event of events) {
		if (event.all_day) {
			allDay.push({ kind: "event", key: `event:${event.id}`, sortAt: "", time: null, event });
			continue;
		}
		timeline.push({
			kind: "event",
			key: `event:${event.id}`,
			sortAt: event.start_at,
			time: formatInstant(event.start_at, tz, "HH:mm"),
			event,
		});
	}

	const dueToday = openTasks.filter((t) => t.due_date === dateIso);
	for (const task of dueToday) {
		const at = taskDueInstant(task, dateIso, tz);
		if (at === null) {
			allDay.push({ kind: "task", key: `task:${task.id}`, sortAt: "", time: null, task });
			continue;
		}
		timeline.push({
			kind: "task",
			key: `task:${task.id}`,
			sortAt: at,
			time: formatInstant(at, tz, "HH:mm"),
			task,
		});
	}

	// Whatever the bands above already show must not repeat below them.
	const placed = new Set(
		[...allDay, ...timeline].filter((i) => i.kind === "task").map((i) => i.task.id),
	);
	const unplaced = openTasks.filter((t) => !placed.has(t.id));
	// Top 3 reaches across every band — a starred task that landed on the
	// timeline still belongs to the day's shortlist. Never capped: the 3-slot
	// rule bounds it in practice, and silently hiding a fourth star would be
	// worse than showing it.
	const top3 = openTasks.filter((t) => isTop3Today(t, dateIso));
	// Open is what is left over: anything unplaced whose due date has already
	// arrived (overdue included — not on the day's spine, but certainly open).
	// Starred rows are excluded because the band above already carries them.
	const arrived = unplaced.filter(
		(t) => !isTop3Today(t, dateIso) && t.due_date !== null && t.due_date <= dateIso,
	);
	// Done rows sink below the open ones and sit outside OPEN_CAP: the cap
	// exists to stop a backlog of *work* from swamping the band, and what was
	// finished today is already bounded by the day itself. Capping the merged
	// list would let this morning's completions push live work off the page.
	const arrivedOpen = arrived.filter((t) => t.status !== "done");
	const arrivedDone = arrived.filter((t) => t.status === "done");

	return {
		allDay: allDay.sort(compareItems),
		timeline: timeline.sort(compareItems),
		top3,
		open: [...arrivedOpen.slice(0, OPEN_CAP), ...arrivedDone],
	};
}

/** The one-sentence commitments anchor under the masthead. */
export function buildAnchor(input: {
	events: CalendarEventRow[];
	openCount: number;
	overdueCount: number;
	nowUtcIso: string;
}): AnchorData {
	const upcoming = input.events
		.filter((e) => !e.all_day && e.start_at >= input.nowUtcIso)
		.sort((a, b) => (a.start_at < b.start_at ? -1 : 1));
	return {
		eventCount: input.events.length,
		nextEvent: upcoming[0] ? { startAt: upcoming[0].start_at, title: upcoming[0].title } : null,
		openCount: input.openCount,
		overdueCount: input.overdueCount,
	};
}

/** Days between two YYYY-MM-DD dates (from → to), pure string math. */
function daysBetween(fromIso: string, toIso: string): number {
	const parse = (iso: string) =>
		Date.UTC(
			parseInt(iso.slice(0, 4), 10),
			parseInt(iso.slice(5, 7), 10) - 1,
			parseInt(iso.slice(8, 10), 10),
		);
	return Math.round((parse(toIso) - parse(fromIso)) / 86_400_000);
}

/**
 * The numeric cadence threshold hiding in a domain's failure_patterns jsonb
 * (seed shape: [{"rule":"no_activity_days","value":7}, …]). Defensive: any
 * malformed shape yields null and the domain simply has no brief line.
 */
export function cadenceThresholdDays(failurePatterns: unknown): number | null {
	if (!Array.isArray(failurePatterns)) return null;
	for (const entry of failurePatterns) {
		if (typeof entry !== "object" || entry === null) continue;
		const { rule, value } = entry as { rule?: unknown; value?: unknown };
		if (
			(rule === "no_activity_days" || rule === "days_since_journal") &&
			typeof value === "number" &&
			value > 0
		) {
			return value;
		}
	}
	return null;
}

/**
 * "In brief" lines: domains at (or approaching) their cadence threshold.
 * Last touch = the most recent of last_shipped_at and the domain's latest
 * completed task; a never-touched domain falls back to its created_at. Lines
 * appear once daysSince reaches 75% of the threshold, so a domain surfaces
 * shortly before it slips — most-slipped first.
 */
export function deriveBriefLines(
	domains: DomainRow[],
	lastTouchByDomain: Record<string, string>,
	todayIso: string,
	tz: string,
): BriefLine[] {
	const lines: BriefLine[] = [];
	for (const domain of domains) {
		const thresholdDays = cadenceThresholdDays(domain.failure_patterns);
		if (thresholdDays === null) continue;

		const touches = [domain.last_shipped_at, lastTouchByDomain[domain.id]].filter(
			(t): t is string => typeof t === "string",
		);
		const touched = touches.length > 0 ? touches.sort().at(-1) : null;
		const lastTouch = touched ?? domain.created_at;
		if (!lastTouch) continue;

		const daysSince = Math.max(0, daysBetween(dateOfInstant(lastTouch, tz), todayIso));
		if (daysSince < Math.ceil(thresholdDays * 0.75)) continue;

		lines.push({
			key: domain.id,
			name: domain.name,
			color: domain.color,
			daysSince,
			thresholdDays,
			slipping: daysSince > thresholdDays,
			unit: daysSince === 1 ? "day since" : "days since",
			nextAction: domain.expected_cadence ?? "Give it some attention.",
			// Deep-link the row so "Mark shipped" / cadence edit are one scroll away
			// rather than dumping the owner at the top of Settings.
			href: `/settings#domain-${domain.id}`,
			lastTouched: touched ? formatInstant(touched, tz, "d LLL") : null,
		});
	}
	return lines.sort((a, b) => b.daysSince / b.thresholdDays - a.daysSince / a.thresholdDays);
}

/**
 * Clock-derived "missed" flag: a routine with a specific time whose time has
 * already passed today and isn't done. Purely a display signal — no DB write,
 * no cron (routines.last_missed_sent_date has no producer and stays that way).
 * Defensive like taskDueInstant: a malformed time degrades to false instead
 * of throwing.
 */
function isRoutineMissed(
	specificTime: string | null,
	done: boolean,
	todayIso: string,
	tz: string,
	nowMs: number,
): boolean {
	if (done || specificTime === null || !isWallClockTime(specificTime)) return false;
	try {
		return Date.parse(instantFromLocal(todayIso, specificTime, tz)) <= nowMs;
	} catch {
		return false;
	}
}

/**
 * Routines grouped for the rail: fixed bucket order, empty buckets dropped,
 * each row carrying done-today, current streak (computeRoutineStats over the
 * recent completion history the fetcher provides), and whether it's missed.
 */
export function bucketRoutines(input: {
	routines: RoutineRow[];
	completions: CompletionRow[];
	todayIso: string;
	tz: string;
	nowMs: number;
}): RoutineBucket[] {
	const { routines, completions, todayIso, tz, nowMs } = input;
	const datesByRoutine = new Map<string, string[]>();
	for (const c of completions) {
		const dates = datesByRoutine.get(c.routine_id);
		if (dates) dates.push(c.completed_date);
		else datesByRoutine.set(c.routine_id, [c.completed_date]);
	}

	const order: RoutineRow["time_of_day"][] = ["morning", "afternoon", "evening", "anytime"];
	return order
		.map((bucket) => ({
			bucket,
			rows: routines
				.filter((r) => r.time_of_day === bucket)
				.map((r) => {
					const stats: RoutineStats = computeRoutineStats(datesByRoutine.get(r.id) ?? [], todayIso);
					return {
						id: r.id,
						name: r.name,
						done: stats.done_today,
						streak: stats.current_streak,
						specificTime: r.specific_time,
						reminderEnabled: r.reminder_enabled,
						missed: isRoutineMissed(r.specific_time, stats.done_today, todayIso, tz, nowMs),
					};
				}),
		}))
		.filter((b) => b.rows.length > 0);
}

/** Milestone-progress summary for active projects, next open milestone first. */
export function summarizeProjects(
	projects: ProjectRow[],
	milestonesByProject: Record<string, MilestoneRow[]>,
): ProjectBrief[] {
	return projects.map((p) => {
		const milestones = milestonesByProject[p.id] ?? [];
		const next = milestones.find((m) => m.status !== "done");
		return {
			id: p.id,
			name: p.name,
			progress: milestoneProgress(milestones),
			nextMilestone: next ? { title: next.title } : null,
		};
	});
}

/** How far back completion history must reach for meaningful streaks. */
const STREAK_HISTORY_DAYS = 60;

/**
 * Hot segment: open tasks + tasks completed on the day + calendar events for
 * the day schedule. Task writes only need this segment to feel current (soft
 * split). Exported so the Cache Components layer can cache digest separately
 * while this path stays request-fresh (docs/adr/0033).
 *
 * `completed` is kept apart from `open` on purpose: only the day bands want
 * it. Every count on the rest of Today — overdue, due today, inbox, the
 * anchor sentence — is a count of outstanding work and must keep reading
 * `open` alone.
 */
export async function loadDayScheduleInputs(
	sb: SupabaseClient,
	tz: string,
	dateIso: string,
): Promise<{ open: TaskRow[]; completed: TaskRow[]; events: CalendarEventRow[] }> {
	const [open, completed, events] = await Promise.all([
		listTasks(sb, { status: "open" }),
		listCompletedOn(sb, dateIso, tz),
		listEventsOn(sb, dateIso, tz),
	]);
	return { open, completed, events };
}

/**
 * Cold segment: quotes, projects, routine history, alerts, domains cadence.
 * Unchanged by a single task checkbox in the common case.
 * Exported for cross-request `"use cache"` (docs/adr/0033).
 */
export async function loadTodayDigest(
	sb: SupabaseClient,
	todayIso: string,
): Promise<{
	routines: RoutineRow[];
	completionsToday: CompletionRow[];
	needsReview: number;
	quotes: QuoteRow[];
	domains: DomainRow[];
	lastTouchByDomain: Record<string, string>;
	unreadNotifications: number;
	skippedQuoteIds: string[];
	completionHistory: CompletionRow[];
	activeProjects: ProjectRow[];
	linksUnread: number;
	milestonesByProject: Record<string, MilestoneRow[]>;
}> {
	const [
		routines,
		completionsToday,
		needsReview,
		quotes,
		domains,
		lastTouchByDomain,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
	] = await Promise.all([
		listRoutines(sb),
		listCompletionsOn(sb, todayIso),
		countNeedsReview(sb),
		listQuotes(sb),
		listDomains(sb),
		lastCompletedByDomain(sb),
		unreadCount(sb),
		listSkippedToday(sb, todayIso),
		listCompletionsSince(sb, shiftDay(todayIso, -STREAK_HISTORY_DAYS)),
		listProjects(sb, { status: "active" }),
		unreadLinkCount(sb),
	]);

	const milestonesByProject = await listMilestonesForProjects(
		sb,
		activeProjects.map((p) => p.id),
	);

	return {
		routines,
		completionsToday,
		needsReview,
		quotes,
		domains,
		lastTouchByDomain,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
		milestonesByProject,
	};
}

/**
 * The day bands for one date, without the ~13-query digest around
 * them. Today's day navigation calls this when it walks off today; the default
 * view keeps reading `getToday().daySchedule` and pays for no extra query.
 */
export async function getDaySchedule(
	sb: SupabaseClient,
	tz: string,
	dateIso: string,
): Promise<DaySchedule> {
	const { open, completed, events } = await loadDayScheduleInputs(sb, tz, dateIso);
	return buildDaySchedule({ events, openTasks: open, completedTasks: completed, dateIso, tz });
}

/**
 * Day bands plus the note-id maps every Today consumer needs for row glyphs.
 * SSR (today-body) and day-nav (loadDayScheduleAction) share this so they
 * cannot drift on which tasks/events get a linked-note lookup.
 *
 * Pass `schedule` when the bands are already loaded (default Today view) to
 * skip a second read.
 */
export async function loadDaySchedulePayload(
	sb: SupabaseClient,
	tz: string,
	dateIso: string,
	opts: {
		todayIso: string;
		nowMs?: number;
		/** Pre-loaded bands; omit to fetch via getDaySchedule. */
		schedule?: DaySchedule;
	},
): Promise<DaySchedulePayload> {
	const nowMs = opts.nowMs ?? Date.now();
	const schedule = opts.schedule ?? (await getDaySchedule(sb, tz, dateIso));
	const nowUtcIso = new Date(nowMs).toISOString();
	const isToday = dateIso === opts.todayIso;

	const eventIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "event")
		.map((item) => item.event.id);
	const scheduledTaskIds = [...schedule.allDay, ...schedule.timeline]
		.filter((item) => item.kind === "task")
		.map((item) => item.task.id);
	const taskIds = [
		...new Set([
			...scheduledTaskIds,
			...schedule.top3.map((task) => task.id),
			...schedule.open.map((task) => task.id),
		]),
	];

	const [eventNoteIds, taskNoteIds] = await Promise.all([
		listNoteIdsForTargets(sb, "event", eventIds).then((map) => Object.fromEntries(map)),
		listNoteIdsForTargets(sb, "task", taskIds).then((map) => Object.fromEntries(map)),
	]);

	return {
		schedule,
		dateIso,
		nowUtcIso,
		nowLabel: isToday ? formatInstant(nowUtcIso, tz, "HH:mm") : null,
		eventNoteIds,
		taskNoteIds,
	};
}

export type TodayDigest = Awaited<ReturnType<typeof loadTodayDigest>>;

/** Pure assembly of the Today view from pre-loaded digest + schedule inputs. */
export function assembleTodayView(
	digest: TodayDigest,
	open: TaskRow[],
	todayEvents: CalendarEventRow[],
	tz: string,
	todayIso: string,
	nowMs: number = Date.now(),
	/** Tasks closed today — day bands only; no count below reads them. */
	completedToday: TaskRow[] = [],
): TodayView {
	const {
		routines,
		completionsToday,
		needsReview,
		quotes,
		domains,
		lastTouchByDomain,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
		milestonesByProject,
	} = digest;

	const overdue = open.filter((t) => isOverdue(t, todayIso));
	const dueToday = open.filter((t) => isDueToday(t, todayIso));
	const inboxCount = open.filter((t) => t.domain_id === null).length;

	const completedRoutineIds = new Set(completionsToday.map((c) => c.routine_id));
	const routinesDone = routines.filter((r) => completedRoutineIds.has(r.id)).length;
	const remainingNames = routines.filter((r) => !completedRoutineIds.has(r.id)).map((r) => r.name);

	const cadence = buildCadenceLines({
		overdue: overdue.length,
		dueToday: dueToday.length,
		routinesDone,
		routinesTotal: routines.length,
		needsReview,
	});

	const resurfaced = pickResurfaced(quotes, todayIso, skippedQuoteIds);
	const latestQuote = [...quotes].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ?? null;

	return {
		cadence,
		inboxCount,
		needsReviewCount: needsReview,
		linksUnreadCount: linksUnread,
		doingToday: assembleDoingToday(open, todayIso),
		daySchedule: buildDaySchedule({
			events: todayEvents,
			openTasks: open,
			completedTasks: completedToday,
			dateIso: todayIso,
			tz,
		}),
		routines: { total: routines.length, done: routinesDone, remainingNames },
		quoteOfDay: quoteOfDay(quotes, todayIso),
		masthead: { isoWeek: isoWeek(todayIso), unreadNotifications },
		anchor: buildAnchor({
			events: todayEvents,
			openCount: open.length,
			overdueCount: overdue.length,
			nowUtcIso: new Date(nowMs).toISOString(),
		}),
		briefLines: deriveBriefLines(domains, lastTouchByDomain, todayIso, tz),
		routineBuckets: bucketRoutines({
			routines,
			completions: completionHistory,
			todayIso,
			tz,
			nowMs,
		}),
		resurfaced,
		resurfacedSkips: skippedQuoteIds.length,
		latestQuote,
		projects: summarizeProjects(activeProjects, milestonesByProject),
	};
}

export async function getToday(
	sb: SupabaseClient,
	tz: string,
	todayIso: string,
	nowMs: number = Date.now(),
): Promise<TodayView> {
	// Soft split: schedule inputs vs digest load in parallel; callers still
	// see one getToday interface. Inbox count is derived from open tasks
	// (no second listInboxTasks query).
	const [{ open, completed, events: todayEvents }, digest] = await Promise.all([
		loadDayScheduleInputs(sb, tz, todayIso),
		loadTodayDigest(sb, todayIso),
	]);
	return assembleTodayView(digest, open, todayEvents, tz, todayIso, nowMs, completed);
}
