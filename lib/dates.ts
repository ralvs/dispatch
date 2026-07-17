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

import { DateTime } from "luxon";

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

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

/** Editorial display formats used across the UI. */
export function formatDay(dateIso: string, tz: string, format = "cccc, d LLLL yyyy"): string {
	return DateTime.fromISO(dateIso, { zone: tz }).toFormat(format);
}

export function formatInstant(utcIso: string, tz: string, format = "d LLL, HH:mm"): string {
	return DateTime.fromISO(utcIso, { zone: "utc" }).setZone(tz).toFormat(format);
}
