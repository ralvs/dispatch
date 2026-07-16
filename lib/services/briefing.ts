import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listBooks } from "@/lib/services/books";
import { type CalendarEventRow, listEventsOn } from "@/lib/services/calendar";
import { countNeedsReview } from "@/lib/services/notes";
import { listQuotes, type QuoteRow } from "@/lib/services/quotes";
import { listCompletionsOn, listRoutines } from "@/lib/services/routines";
import { listInboxTasks, listTasks, type TaskRow } from "@/lib/services/tasks";
import { isOverdue, isTop3Today } from "@/lib/task-predicates";

// ─────────────────────────────────────────────────────────────────────────
// The Today page's editorial briefing (Phase 6). getBriefing assembles a
// single read of the day's shape — cadence, inbox, doing-today, routines,
// resurfaced quote — from the underlying services. The pure helpers below
// are unit-tested in isolation; the fetcher composes them.
// ─────────────────────────────────────────────────────────────────────────

export type CadenceLine = {
	key: string;
	big: string;
	label: string;
	href: string;
	slip?: boolean;
};

export type BriefingView = {
	cadence: CadenceLine[];
	inboxCount: number;
	doingToday: TaskRow[];
	routines: { total: number; done: number; remainingNames: string[] };
	quoteOfDay: QuoteRow | null;
	todayEvents: CalendarEventRow[];
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

export async function getBriefing(
	sb: SupabaseClient,
	tz: string,
	todayIso: string,
): Promise<BriefingView> {
	const [open, inbox, routines, completionsToday, reading, needsReview, quotes, todayEvents] =
		await Promise.all([
			listTasks(sb, { status: "open" }),
			listInboxTasks(sb),
			listRoutines(sb),
			listCompletionsOn(sb, todayIso),
			listBooks(sb, { status: "reading" }),
			countNeedsReview(sb),
			listQuotes(sb),
			listEventsOn(sb, todayIso, tz),
		]);

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

	return {
		cadence,
		inboxCount: inbox.length,
		doingToday: assembleDoingToday(open, todayIso),
		routines: { total: routines.length, done: routinesDone, remainingNames },
		quoteOfDay: quoteOfDay(quotes, todayIso),
		todayEvents,
	};
}
