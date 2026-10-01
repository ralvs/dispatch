import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInstant, isoWeek, shiftDay } from "@/lib/dates";
import { buildDaySchedule, type DaySchedule, type DaySchedulePayload } from "@/lib/day-schedule";
import { bucketRoutines, type RoutineBucket } from "@/lib/routine-buckets";
import { ROUTINE_HISTORY_DAYS } from "@/lib/routine-stats";
import { type CalendarEventRow, listEventsOn } from "@/lib/services/calendar";
import { type DomainRow, listDomains } from "@/lib/services/domains";
import { unreadLinkCount } from "@/lib/services/links";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { countNeedsReview } from "@/lib/services/notes";
import { unreadCount } from "@/lib/services/notifications";
import {
	countTasksByProject,
	EMPTY_TASK_COUNTS,
	listProjects,
	type ProjectRow,
	type ProjectTaskCounts,
	taskProgress,
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
import { listCompletedOn, listTasks, type TaskRow } from "@/lib/services/tasks";
import { isOverdue } from "@/lib/task-predicates";

// Day placement lives in lib/day-schedule.ts (client-safe). Import Day*
// types from there — this module is the Today read (digest + loaders).

// ─────────────────────────────────────────────────────────────────────────
// The Today page's data. getToday assembles a single read of the day's
// shape — anchor, doing-today, routines, quotes, and
// at-a-glance widgets — from the underlying services. The pure helpers below
// are unit-tested in isolation; the fetcher composes them.
//
// Vocabulary (docs/adr/0036). The prefix tells you what a name follows:
//
//   Today*  is locked to the real calendar today.
//     TodayView    — everything the page renders (digest + today's schedule)
//     TodayDigest  — the cold half: quotes, projects, routines, alert
//                    counts. Cross-request cached (lib/cache/today.ts).
//
//   Day*    follows the date picker (`?d=`), so it is not necessarily today.
//     DaySchedule  — tasks + events for ONE date, in four bands
//                    (All day / Timeline / Top 3 / Open)
//     DayView      — the UI region that owns day navigation, the page's
//                    composition, and the optimistic store the bands share
//     DayBands     — Top3Section / TimelineSection / OpenSection; DayTape the
//                    tape and the all-day band; DayNav the chevrons
//
// ─────────────────────────────────────────────────────────────────────────

export type AnchorData = {
	eventCount: number;
	nextEvent: { startAt: string; title: string } | null;
	openCount: number;
	overdueCount: number;
};

export type { RoutineBucket, RoutineBucketRow } from "@/lib/routine-buckets";

export type ProjectBrief = {
	id: string;
	name: string;
	progress: number;
	/** The project's own tasks — done and total. Since the shape plan's P5 the
	 * ring and the count read the same thing: milestones were a weighted
	 * checklist that only moved when you ticked it, so ring and count could
	 * disagree. Kept as two fields because the row still shows both. */
	doneCount: number;
	totalCount: number;
	/** Palette slug (lib/schemas/color.ts), or null — colours the ring. */
	color: string | null;
};

export type TodayView = {
	// Counts Today's alerts row reads: tasks with no domain, notes the parser
	// could not place, links not yet read.
	inboxCount: number;
	needsReviewCount: number;
	linksUnreadCount: number;
	daySchedule: DaySchedule;
	routines: { total: number; done: number; remainingNames: string[] };
	quoteOfDay: QuoteRow | null;
	masthead: { isoWeek: number; unreadNotifications: number };
	anchor: AnchorData;
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

/** What the Resurfaced card shows: today's pick, the skips behind it, and whether there are quotes at all. */
export type ResurfacedState = { quote: QuoteRow | null; skips: number; hasQuotes: boolean };

/**
 * The Resurfaced card's state as it stands now — what "Next →" and "Reset"
 * answer with (#30), so the card moves without a page render. Same pick as
 * the digest's (`pickResurfaced`).
 */
export async function loadResurfaced(
	sb: SupabaseClient,
	todayIso: string,
): Promise<ResurfacedState> {
	const [quotes, skipped] = await Promise.all([listQuotes(sb), listSkippedToday(sb, todayIso)]);
	return {
		quote: pickResurfaced(quotes, todayIso, skipped),
		skips: skipped.length,
		hasQuotes: quotes.length > 0,
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

export { bucketRoutines };

/** Task-progress summary for active projects (shape plan §02, decision D2). */
export function summarizeProjects(
	projects: ProjectRow[],
	taskCountsByProject: Record<string, ProjectTaskCounts>,
): ProjectBrief[] {
	return projects.map((p) => {
		const counts = taskCountsByProject[p.id] ?? EMPTY_TASK_COUNTS;
		return {
			id: p.id,
			name: p.name,
			progress: taskProgress(counts),
			doneCount: counts.done,
			totalCount: counts.done + counts.open,
			color: p.color ?? null,
		};
	});
}

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
		// Quiet tasks never reach a day: an undated task in a project that is not
		// active is not today's work. A dated one still arrives, whatever its
		// project's status.
		listTasks(sb, { status: "open", excludeQuiet: true }),
		listCompletedOn(sb, dateIso, tz),
		listEventsOn(sb, dateIso, tz),
	]);
	return { open, completed, events };
}

/**
 * Cold segment: quotes, projects, routine history, alerts, domains.
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
	unreadNotifications: number;
	skippedQuoteIds: string[];
	completionHistory: CompletionRow[];
	activeProjects: ProjectRow[];
	linksUnread: number;
	taskCountsByProject: Record<string, ProjectTaskCounts>;
}> {
	const [
		routines,
		completionsToday,
		needsReview,
		quotes,
		domains,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
		// countTasksByProject depends on nothing above it, so awaiting it after
		// the fan-out bought one extra serial round trip on the critical path of
		// Today, /api/widget and /api/chat, for nothing.
		taskCountsByProject,
	] = await Promise.all([
		listRoutines(sb),
		listCompletionsOn(sb, todayIso),
		countNeedsReview(sb),
		listQuotes(sb),
		listDomains(sb),
		unreadCount(sb),
		listSkippedToday(sb, todayIso),
		listCompletionsSince(sb, shiftDay(todayIso, -ROUTINE_HISTORY_DAYS)),
		listProjects(sb, { status: "active" }),
		unreadLinkCount(sb),
		countTasksByProject(sb),
	]);

	return {
		routines,
		completionsToday,
		needsReview,
		quotes,
		domains,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
		taskCountsByProject,
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
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		activeProjects,
		linksUnread,
		taskCountsByProject,
	} = digest;

	const overdue = open.filter((t) => isOverdue(t, todayIso));
	const inboxCount = open.filter((t) => t.domain_id === null).length;

	const completedRoutineIds = new Set(completionsToday.map((c) => c.routine_id));
	const routinesDone = routines.filter((r) => completedRoutineIds.has(r.id)).length;
	const remainingNames = routines.filter((r) => !completedRoutineIds.has(r.id)).map((r) => r.name);

	const resurfaced = pickResurfaced(quotes, todayIso, skippedQuoteIds);
	const latestQuote = [...quotes].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ?? null;

	return {
		inboxCount,
		needsReviewCount: needsReview,
		linksUnreadCount: linksUnread,
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
		projects: summarizeProjects(activeProjects, taskCountsByProject),
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
