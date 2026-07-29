// The single home of timezone-aware date logic (docs/adr/0002).
//
// Storage is always UTC. These helpers exist to answer exactly two kinds of
// questions at the boundary:
//   1. "What calendar day is it (or does this instant fall on) in the app
//      timezone?"  → date-only strings (YYYY-MM-DD) for `date` columns.
//   2. "What UTC range does this app-timezone day span?" → for querying
//      timestamptz columns by day.
//
// Every function takes the timezone explicitly — pure and testable. The
// timezone value comes from app_settings via lib/services/settings.ts.

import { DateTime, IANAZone } from "luxon";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/**
 * Whether this runtime recognises the string as an IANA zone. The gate on the
 * settings editor: every day boundary in the app is derived from this value,
 * so a typo must never reach app_settings.
 */
export function isValidTimezone(tz: string): boolean {
	return IANAZone.isValidZone(tz);
}

/** Today's calendar date (YYYY-MM-DD) in the app timezone. */
export function todayInTz(tz: string, nowMs: number = Date.now()): string {
	const iso = DateTime.fromMillis(nowMs, { zone: tz }).toISODate();
	if (!iso) throw new Error(`Invalid timezone: ${tz}`);
	return iso;
}

/** The calendar date a UTC instant falls on in the app timezone. */
export function dateOfInstant(utcIso: string, tz: string): string {
	const iso = DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toISODate();
	if (!iso) throw new Error(`Invalid instant: ${utcIso}`);
	return iso;
}

/**
 * The UTC instant range [startUtc, endUtc) covering one app-timezone
 * calendar day. Use for querying timestamptz columns by local day.
 */
export function dayWindowUtc(dateIso: string, tz: string): { startUtc: string; endUtc: string } {
	const start = DateTime.fromISO(dateIso, { zone: tz }).startOf("day");
	if (!start.isValid) throw new Error(`Invalid date/timezone: ${dateIso} ${tz}`);
	const end = start.plus({ days: 1 });
	return {
		startUtc: start.toUTC().toISO(),
		endUtc: end.toUTC().toISO(),
	};
}

/** Shift a calendar date by N days (pure string math, no timezone needed). */
export function shiftDay(dateIso: string, days: number): string {
	const iso = DateTime.fromISO(dateIso, { zone: "utc" }).plus({ days }).toISODate();
	if (!iso) throw new Error(`Invalid date: ${dateIso}`);
	return iso;
}

/** Monday of the week containing the given calendar date. */
export function startOfWeek(dateIso: string): string {
	const iso = DateTime.fromISO(dateIso, { zone: "utc" }).startOf("week").toISODate();
	if (!iso) throw new Error(`Invalid date: ${dateIso}`);
	return iso;
}

/** Current instant as a UTC ISO string — the only sanctioned "now" for storage. */
export function nowUtc(nowMs: number = Date.now()): string {
	return new Date(nowMs).toISOString();
}

/** Combine an app-timezone calendar date + wall-clock time into a UTC instant. */
export function instantFromLocal(dateIso: string, time: string, tz: string): string {
	const dt = DateTime.fromISO(`${dateIso}T${time}`, { zone: tz });
	if (!dt.isValid) throw new Error(`Invalid local datetime: ${dateIso}T${time} ${tz}`);
	const iso = dt.toUTC().toISO();
	if (!iso) throw new Error(`Invalid local datetime: ${dateIso}T${time} ${tz}`);
	return iso;
}

/** Shift a UTC instant by N minutes (positive or negative). DST-safe by construction — instant math, not wall-clock math. */
export function shiftMinutes(utcIso: string, minutes: number): string {
	const dt = DateTime.fromISO(utcIso, { zone: "utc" }).plus({ minutes });
	const iso = dt.toISO();
	if (!iso) throw new Error(`Invalid instant: ${utcIso}`);
	return iso;
}

// Postgres `time` columns arrive `HH:MM:SS`; hand-entered/form values may be
// `HH:MM`. Shared here so every wall-clock-time validator agrees.
// Fractional seconds are accepted because a Postgres `time` column may carry
// them (any value written as an expression rather than a plain literal). They
// used to fail this test, and a rejected time is not loud — it silently falls
// back to a default anchor, so the reminder fires at the wrong hour instead of
// erroring. Luxon parses the fraction fine.
const TIME_RE = /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Whether a value looks like a wall-clock time string (`HH:MM`, `HH:MM:SS`, or with a fraction). */
export function isWallClockTime(s: unknown): boolean {
	return typeof s === "string" && TIME_RE.test(s);
}

/** ISO week number of a calendar date (pure string math, no timezone needed). */
export function isoWeek(dateIso: string): number {
	const dt = DateTime.fromISO(dateIso, { zone: "utc" });
	if (!dt.isValid) throw new Error(`Invalid date: ${dateIso}`);
	return dt.weekNumber;
}

/** Masthead dateline: `THU · JUL 17 · WEEK 29`. */
export function formatDateline(dateIso: string): string {
	const dt = DateTime.fromISO(dateIso, { zone: "utc" });
	if (!dt.isValid) throw new Error(`Invalid date: ${dateIso}`);
	return `${dt.toFormat("ccc · LLL d").toUpperCase()} · WEEK ${dt.weekNumber}`;
}

/**
 * A `YYYY-MM-DD` calendar date from untrusted input (a query string), or null.
 * Rejects anything that isn't a real day — `2026-02-30` parses as a Luxon
 * date but is not one, so `isValid` is the gate rather than the shape alone.
 */
export function parseDateIso(value: unknown): string | null {
	if (typeof value !== "string" || !DATE_RE.test(value)) return null;
	const dt = DateTime.fromISO(value, { zone: "utc" });
	if (!dt.isValid || dt.toISODate() !== value) return null;
	return value;
}

/** Day-navigation label: `TODAY`, `YESTERDAY`, `TOMORROW`, else `WED · JUL 29`. */
export function formatDayNavLabel(dateIso: string, todayIso: string): string {
	const days = Math.round(
		DateTime.fromISO(dateIso, { zone: "utc" }).diff(
			DateTime.fromISO(todayIso, { zone: "utc" }),
			"days",
		).days,
	);
	if (days === 0) return "TODAY";
	if (days === -1) return "YESTERDAY";
	if (days === 1) return "TOMORROW";
	return DateTime.fromISO(dateIso, { zone: "utc" }).toFormat("ccc · LLL d").toUpperCase();
}

/** Editorial display formats used across the UI. */
export function formatDay(dateIso: string, tz: string, format = "cccc, d LLLL yyyy"): string {
	return DateTime.fromISO(dateIso, { zone: tz }).toFormat(format);
}

export function formatInstant(utcIso: string, tz: string, format = "d LLL, HH:mm"): string {
	return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat(format);
}

/** Relative due-date label for task rows: `overdue 3d`, `due today`, `due in 2d`. */
export function formatDueLabel(dueDateIso: string, todayIso: string): string {
	const due = DateTime.fromISO(dueDateIso, { zone: "utc" });
	const today = DateTime.fromISO(todayIso, { zone: "utc" });
	const days = Math.round(due.diff(today, "days").days);
	if (days === 0) return "due today";
	if (days < 0) return `overdue ${-days}d`;
	return `due in ${days}d`;
}
