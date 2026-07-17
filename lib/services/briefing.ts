import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dateOfInstant, isoWeek, shiftDay } from "@/lib/dates";
import { computeRoutineStats, type RoutineStats } from "@/lib/routine-stats";
import { type BookRow, listBooks } from "@/lib/services/books";
import { type CalendarEventRow, listEventsOn } from "@/lib/services/calendar";
import { type DomainRow, listDomains } from "@/lib/services/domains";
import {
	type HealthMetricRow,
	listMedications,
	listMetrics,
	listWellbeingCheckIns,
	listWorkouts,
	type WellbeingCheckInRow,
	type WorkoutRow,
} from "@/lib/services/health";
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
	listInboxTasks,
	listTasks,
	type TaskRow,
} from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";

// ─────────────────────────────────────────────────────────────────────────
// The Today page's editorial briefing. getBriefing assembles a single read
// of the day's shape — masthead, anchor, brief lines, doing-today, routines,
// quotes, and at-a-glance widgets — from the underlying services. The pure
// helpers below are unit-tested in isolation; the fetcher composes them.
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
	daysSince: number;
	thresholdDays: number;
	slipping: boolean;
	unit: string;
	nextAction: string;
	href: string;
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

export type HealthGlance = {
	latestMetric: HealthMetricRow | null;
	activeMedsCount: number;
	lastWorkout: WorkoutRow | null;
	lastCheckIn: WellbeingCheckInRow | null;
};

export type BriefingView = {
	cadence: CadenceLine[];
	inboxCount: number;
	doingToday: TaskRow[];
	routines: { total: number; done: number; remainingNames: string[] };
	quoteOfDay: QuoteRow | null;
	todayEvents: CalendarEventRow[];
	masthead: { isoWeek: number; unreadNotifications: number };
	anchor: AnchorData;
	briefLines: BriefLine[];
	routineBuckets: RoutineBucket[];
	resurfaced: QuoteRow | null;
	resurfacedSkips: number;
	latestQuote: QuoteRow | null;
	health: HealthGlance;
	projects: ProjectBrief[];
	readingBooks: BookRow[];
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
	readingCount: number;
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

	if (input.readingCount > 0) {
		lines.push({
			key: "reading",
			big: String(input.readingCount),
			label: "reading",
			href: "/books",
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
		if (domain.is_system) continue;
		const thresholdDays = cadenceThresholdDays(domain.failure_patterns);
		if (thresholdDays === null) continue;

		const touches = [domain.last_shipped_at, lastTouchByDomain[domain.id]].filter(
			(t): t is string => typeof t === "string",
		);
		const lastTouch = touches.length > 0 ? touches.sort().at(-1) : domain.created_at;
		if (!lastTouch) continue;

		const daysSince = Math.max(0, daysBetween(dateOfInstant(lastTouch, tz), todayIso));
		if (daysSince < Math.ceil(thresholdDays * 0.75)) continue;

		lines.push({
			key: domain.id,
			name: domain.name,
			daysSince,
			thresholdDays,
			slipping: daysSince > thresholdDays,
			unit: daysSince === 1 ? "day since" : "days since",
			nextAction: domain.expected_cadence ?? "Give it some attention.",
			href: "/domains",
		});
	}
	return lines.sort((a, b) => b.daysSince / b.thresholdDays - a.daysSince / a.thresholdDays);
}

/**
 * Routines grouped for the rail: fixed bucket order, empty buckets dropped,
 * each row carrying done-today and current streak (computeRoutineStats over
 * the recent completion history the fetcher provides).
 */
export function bucketRoutines(
	routines: RoutineRow[],
	completions: CompletionRow[],
	todayIso: string,
): RoutineBucket[] {
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

export async function getBriefing(
	sb: SupabaseClient,
	tz: string,
	todayIso: string,
	nowMs: number = Date.now(),
): Promise<BriefingView> {
	const [
		open,
		inbox,
		routines,
		completionsToday,
		reading,
		needsReview,
		quotes,
		todayEvents,
		domains,
		lastTouchByDomain,
		unreadNotifications,
		skippedQuoteIds,
		completionHistory,
		latestMetrics,
		activeMedications,
		recentWorkouts,
		recentCheckIns,
		activeProjects,
	] = await Promise.all([
		listTasks(sb, { status: "open" }),
		listInboxTasks(sb),
		listRoutines(sb),
		listCompletionsOn(sb, todayIso),
		listBooks(sb, { status: "reading" }),
		countNeedsReview(sb),
		listQuotes(sb),
		listEventsOn(sb, todayIso, tz),
		listDomains(sb),
		lastCompletedByDomain(sb),
		unreadCount(sb),
		listSkippedToday(sb, todayIso),
		listCompletionsSince(sb, shiftDay(todayIso, -STREAK_HISTORY_DAYS)),
		listMetrics(sb, { limit: 1 }),
		listMedications(sb),
		listWorkouts(sb, { limit: 1 }),
		listWellbeingCheckIns(sb, { limit: 1 }),
		listProjects(sb, { status: "active" }),
	]);

	const milestonesByProject = await listMilestonesForProjects(
		sb,
		activeProjects.map((p) => p.id),
	);

	const overdue = open.filter((t) => isOverdue(t, todayIso));
	const dueToday = open.filter((t) => t.due_date === todayIso);

	const completedRoutineIds = new Set(completionsToday.map((c) => c.routine_id));
	const routinesDone = routines.filter((r) => completedRoutineIds.has(r.id)).length;
	const remainingNames = routines.filter((r) => !completedRoutineIds.has(r.id)).map((r) => r.name);

	const cadence = buildCadenceLines({
		overdue: overdue.length,
		dueToday: dueToday.length,
		routinesDone,
		routinesTotal: routines.length,
		readingCount: reading.length,
		needsReview,
	});

	const resurfaced = pickResurfaced(quotes, todayIso, skippedQuoteIds);
	const latestQuote = [...quotes].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0] ?? null;

	return {
		cadence,
		inboxCount: inbox.length,
		doingToday: assembleDoingToday(open, todayIso),
		routines: { total: routines.length, done: routinesDone, remainingNames },
		quoteOfDay: quoteOfDay(quotes, todayIso),
		todayEvents,
		masthead: { isoWeek: isoWeek(todayIso), unreadNotifications },
		anchor: buildAnchor({
			events: todayEvents,
			openCount: open.length,
			overdueCount: overdue.length,
			nowUtcIso: new Date(nowMs).toISOString(),
		}),
		briefLines: deriveBriefLines(domains, lastTouchByDomain, todayIso, tz),
		routineBuckets: bucketRoutines(routines, completionHistory, todayIso),
		resurfaced,
		resurfacedSkips: skippedQuoteIds.length,
		latestQuote,
		health: {
			latestMetric: latestMetrics[0] ?? null,
			activeMedsCount: activeMedications.length,
			lastWorkout: recentWorkouts[0] ?? null,
			lastCheckIn: recentCheckIns[0] ?? null,
		},
		projects: summarizeProjects(activeProjects, milestonesByProject),
		readingBooks: reading,
	};
}
