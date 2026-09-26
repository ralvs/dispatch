// Recurrence patterns + helpers for repeating tasks.
//
// The DB stores recurrence as a plain text column (tasks.recurrence_rule).
// We keep the vocabulary small + flat for v1 — every supported pattern
// is a single literal string. If/when we need "every 3 weeks" or RRULE-
// style flexibility, we can extend the parser without a migration.
//
// The shape plan's P7 took exactly that route: a rule may now also be
// `weekly:tu,sa` — the word `weekly`, a colon, then two-letter weekday codes
// (see WEEKDAY_CODES). All seven literals stay valid exactly as they are.
//
// It did need one migration after all. The column is text, but
// 20260715183208_recurrence_checks.sql had pinned it to the seven literals
// with tasks_recurrence_rule_check, so Postgres would have rejected the
// insert; 20260906140000_recurrence_custom_weekly.sql widens that constraint
// and touches nothing else.
//
// Deliberately NOT RFC 5545 (`FREQ=WEEKLY;BYDAY=TU,SA`). That is the right
// answer for an app that syncs recurrence with a calendar; Dispatch does not,
// and adopting the grammar invites counts, intervals and month-day sets one
// support request at a time. The grammar stops at weekly-on-weekdays (plan
// O8), and `weekdays` keeps its own literal rather than being rewritten to
// `weekly:mo,tu,we,th,fr` — the stored rows already say `weekdays`.

export const RECURRENCE_PATTERNS = [
	"daily",
	"weekdays",
	"weekly",
	"biweekly",
	"monthly",
	"semiannually",
	"yearly",
] as const;
export type RecurrencePattern = (typeof RECURRENCE_PATTERNS)[number];

export const RECURRENCE_LABELS: Record<RecurrencePattern, string> = {
	daily: "Daily",
	weekdays: "Weekdays",
	weekly: "Weekly",
	biweekly: "Every 2 weeks",
	monthly: "Monthly",
	semiannually: "Every 6 months",
	yearly: "Yearly",
};

// Glyph shown on task rows to indicate recurrence at a glance.
export const RECURRENCE_GLYPH = "↻";

export function isRecurrencePattern(s: unknown): s is RecurrencePattern {
	return typeof s === "string" && (RECURRENCE_PATTERNS as readonly string[]).includes(s);
}

// ─── The custom weekly rule ───────────────────────────────────────────
//
// `weekly:tu,sa` — "weekly on Tuesdays and Saturdays". Codes are the first two
// letters of the English weekday name, ordered Sunday-first to match
// Date#getUTCDay so the index IS the day number.

export const WEEKDAY_CODES = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

const WEEKDAY_LABELS: Record<WeekdayCode, string> = {
	su: "Sun",
	mo: "Mon",
	tu: "Tue",
	we: "Wed",
	th: "Thu",
	fr: "Fri",
	sa: "Sat",
};

const CUSTOM_WEEKLY_PREFIX = "weekly:";

/**
 * Parse `weekly:tu,sa` into day numbers (0=Sun..6=Sat), or null when the
 * string is not a custom weekly rule.
 *
 * Strict on purpose: an unknown code, a duplicate, or an empty list yields
 * null rather than a partial rule. A rule this function cannot read is one the
 * roll-forward must not guess at.
 */
export function parseCustomWeekly(rule: string | null | undefined): number[] | null {
	if (typeof rule !== "string" || !rule.startsWith(CUSTOM_WEEKLY_PREFIX)) return null;
	const body = rule.slice(CUSTOM_WEEKLY_PREFIX.length);
	if (body === "") return null;
	const days = new Set<number>();
	for (const code of body.split(",")) {
		const index = (WEEKDAY_CODES as readonly string[]).indexOf(code);
		if (index === -1 || days.has(index)) return null;
		days.add(index);
	}
	return [...days].sort((a, b) => a - b);
}

/** Day numbers → the stored rule string. Empty selection means "no rule". */
export function formatCustomWeekly(days: readonly number[]): string {
	const unique = [...new Set(days)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
	if (unique.length === 0) return "";
	return CUSTOM_WEEKLY_PREFIX + unique.map((d) => WEEKDAY_CODES[d]).join(",");
}

/** Anything the app can store in tasks.recurrence_rule and act on. */
export function isRecurrenceRule(s: unknown): boolean {
	return isRecurrencePattern(s) || parseCustomWeekly(typeof s === "string" ? s : null) !== null;
}

/** Human label for a stored rule string, or null when it isn't a known rule. */
export function recurrenceLabel(rule: string | null | undefined): string | null {
	if (isRecurrencePattern(rule)) return RECURRENCE_LABELS[rule];
	const days = parseCustomWeekly(rule);
	if (days === null) return null;
	return days.map((d) => WEEKDAY_LABELS[WEEKDAY_CODES[d]]).join(", ");
}

// ─── Date math ────────────────────────────────────────────────────────
//
// All dates round-trip as YYYY-MM-DD strings — that's the wire format
// PostgreSQL `date` columns and HTML <input type="date"> agree on. A
// "due date" is a calendar day, not an instant, so the math here is
// plain UTC arithmetic on date strings (docs/adr/0002: the app timezone
// is applied by the CALLER when deciding what "today" means).

function parseIsoDate(iso: string): Date {
	// Anchor at noon UTC so DST never shifts the day.
	return new Date(`${iso}T12:00:00Z`);
}

function formatIsoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
	const next = new Date(d);
	next.setUTCDate(next.getUTCDate() + n);
	return next;
}

function lastDayOfMonth(y: number, m: number): number {
	// Day 0 of the month *after* it.
	return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

// Adds N months and lands on `day`, clamped to the last valid day. E.g.
// Jan 31 + 1mo = Feb 28 (or 29 in a leap year), not Mar 3 like JS's native
// overflow.
function addMonthsOnDay(d: Date, n: number, day: number): Date {
	const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12, 0, 0));
	const y = target.getUTCFullYear();
	const m = target.getUTCMonth();
	return new Date(Date.UTC(y, m, Math.min(day, lastDayOfMonth(y, m)), 12, 0, 0));
}

const MONTH_STEP: Partial<Record<RecurrencePattern, number>> = {
	monthly: 1,
	semiannually: 6,
	yearly: 12,
};

/**
 * The day of the month a month-stepped series is meant to fall on.
 *
 * A series on the 31st lands on Apr 30 and Feb 28 because those months end
 * early. The due date alone would then say "the 30th", and the series would
 * drift one clamp at a time. `tasks.recurrence_day` keeps the 31 for as long
 * as the due date sits clamped on a month end below it.
 *
 * The stored day counts only in that position. A due date moved by hand to
 * any other day is the new day of the series, and the stored day drops.
 */
function intendedMonthDay(due: Date, recurrenceDay: number | null | undefined): number {
	const day = due.getUTCDate();
	const clamped = day === lastDayOfMonth(due.getUTCFullYear(), due.getUTCMonth());
	return recurrenceDay != null && recurrenceDay > day && clamped ? recurrenceDay : day;
}

export type NextOccurrence = {
	dueDate: string;
	/** For `tasks.recurrence_day`: the intended day when `dueDate` is clamped, else null. */
	recurrenceDay: number | null;
};

// Compute the next occurrence after completing a recurring task.
//
// Behavior decisions worth flagging:
//
//   1. The series keeps its own cadence. A weekly task due Saturday and
//      ticked late on Monday comes back the next Saturday, not the next
//      Monday: the day you tick it says nothing about the day it is due.
//      Fixed-interval rules count whole intervals from the current due date
//      until they clear today.
//
//   2. We never return a date in the past, or today. A task overdue by a
//      month skips the occurrences it missed rather than spawning them, so
//      you do not have to tick it again straight away.
//
//   3. Day-set rules ('weekdays', `weekly:tu,sa`) advance to the next listed
//      weekday after max(currentDue, today). The day set is the cadence, so
//      there is no interval to count.
//
//   4. Month steps keep the day of the month. A month too short for it
//      clamps to its last day, and the next long-enough month returns to it:
//      Jan 31 → Feb 28 → Mar 31, never Mar 28. See intendedMonthDay.
export function nextOccurrence(params: {
	currentDue: string | null | undefined;
	rule: RecurrencePattern | string;
	todayIso: string;
	recurrenceDay?: number | null;
}): NextOccurrence {
	const today = parseIsoDate(params.todayIso);
	const anchor = params.currentDue ? parseIsoDate(params.currentDue) : today;

	const dayset = params.rule === "weekdays" ? [1, 2, 3, 4, 5] : parseCustomWeekly(params.rule);
	if (dayset !== null) {
		let next = addDays(anchor > today ? anchor : today, 1);
		// At most seven steps: one of the seven weekdays is always in the set.
		for (let i = 0; i < 7 && !dayset.includes(next.getUTCDay()); i++) {
			next = addDays(next, 1);
		}
		return { dueDate: formatIsoDate(next), recurrenceDay: null };
	}

	const rule = params.rule as Exclude<RecurrencePattern, "weekdays">;
	const months = MONTH_STEP[rule];
	const day = intendedMonthDay(anchor, params.recurrenceDay);
	// The k-th occurrence after the anchor.
	const nth = (k: number): Date => {
		if (months !== undefined) return addMonthsOnDay(anchor, months * k, day);
		const days = rule === "daily" ? 1 : rule === "weekly" ? 7 : 14;
		return addDays(anchor, days * k);
	};

	// Terminates: every rule moves strictly forward as k grows.
	let k = 1;
	while (nth(k) <= today) k++;
	const next = nth(k);
	return {
		dueDate: formatIsoDate(next),
		recurrenceDay: months !== undefined && next.getUTCDate() < day ? day : null,
	};
}

/** The next due date alone — for callers that only show it. */
export function nextDueDate(params: Parameters<typeof nextOccurrence>[0]): string {
	return nextOccurrence(params).dueDate;
}

// ─── Period-window helpers for recurring checklist items ──────────────
//
// A recurring checklist item is "currently done" if it was marked done
// within the current period. The period start is rule-dependent:
//   daily       → today at 00:00
//   weekdays    → today at 00:00 if today is a weekday; else previous Friday
//   weekly      → most recent Monday at 00:00
//   biweekly    → rolling 14-day window ending now
//   monthly     → 1st of this month at 00:00
//   yearly      → Jan 1 of this year at 00:00
//
// "now" is passed in so the caller controls the timezone interpretation;
// the helpers do plain UTC math on the timestamp the caller gives them.

export function periodStart(rule: RecurrencePattern | string, nowMs: number): number {
	// A custom weekly rule shares plain weekly's Monday-anchored window: the
	// question is "done this week", and which weekdays it lands on does not
	// change where the week starts.
	const effective: RecurrencePattern =
		parseCustomWeekly(rule) !== null ? "weekly" : (rule as RecurrencePattern);
	const d = new Date(nowMs);
	const y = d.getUTCFullYear();
	const m = d.getUTCMonth();
	const day = d.getUTCDate();

	switch (effective) {
		case "daily":
			return Date.UTC(y, m, day);
		case "weekdays": {
			const dow = d.getUTCDay(); // 0=Sun..6=Sat
			// Saturday → most recent Friday. Sunday → previous Friday.
			// Otherwise → today.
			if (dow === 6) return Date.UTC(y, m, day - 1);
			if (dow === 0) return Date.UTC(y, m, day - 2);
			return Date.UTC(y, m, day);
		}
		case "weekly": {
			// Monday-anchored week.
			const dow = d.getUTCDay();
			const daysBack = dow === 0 ? 6 : dow - 1;
			return Date.UTC(y, m, day - daysBack);
		}
		case "biweekly": {
			// Rolling 14-day window ending at "now".
			return nowMs - 14 * 86_400_000;
		}
		case "monthly":
			return Date.UTC(y, m, 1);
		case "semiannually":
			// Calendar half-year anchor: Jan 1 if we're in H1, Jul 1 if H2.
			// Keeps "done this half" feeling stable until the half flips.
			return Date.UTC(y, m < 6 ? 0 : 6, 1);
		case "yearly":
			return Date.UTC(y, 0, 1);
	}
}

// Whether a recurring checklist item should render as "currently done":
// true if it has a done_at within the current period AND done is true.
// For non-recurring items the caller can just check `done`; this helper
// is only meaningful when a recurrence rule is set.
export function isCurrentlyDoneRecurring(
	done: boolean,
	doneAtIso: string | null | undefined,
	rule: RecurrencePattern | string,
	nowMs: number = Date.now(),
): boolean {
	if (!done || !doneAtIso) return false;
	const doneMs = Date.parse(doneAtIso);
	if (Number.isNaN(doneMs)) return false;
	return doneMs >= periodStart(rule, nowMs);
}
