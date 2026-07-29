/**
 * Rolling window for calendar pull syncs (iCloud CalDAV + Google).
 *
 * Also the practical range of Today's day navigation: stepping outside the
 * window still renders, it just has no events to show. The Mac bridge keeps its
 * own copy of this (`windowDays` in scripts/mac-calendar-bridge/main.swift) —
 * change both together.
 */
export const CALENDAR_SYNC_WINDOW_DAYS = 21;
export const CALENDAR_SYNC_WINDOW_MS = CALENDAR_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
