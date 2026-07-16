import "server-only";
import { createDAVClient } from "tsdav";
import { env } from "@/lib/env";

// ─────────────────────────────────────────────────────────────────────────
// Thin wrapper over tsdav (docs/adr/0006). Not unit-tested — this is the
// network edge; lib/services/calendar.ts is tested against the narrow
// CaldavConnection interface below, stubbed.
// ─────────────────────────────────────────────────────────────────────────

export type CaldavCalendarObject = { href: string; etag: string; data: string };

/** Exactly what the sync service needs from a CalDAV connection. */
export type CaldavConnection = {
	listCalendars(): Promise<{ displayName: string; url: string }[]>;
	fetchObjectsInWindow(
		calendarUrl: string,
		window: { startUtc: string; endUtc: string },
	): Promise<CaldavCalendarObject[]>;
	createObject(calendarUrl: string, filename: string, icalText: string): Promise<void>;
};

function displayNameOf(name: string | Record<string, unknown> | undefined): string {
	if (typeof name === "string") return name;
	if (name && typeof name === "object") return String(Object.values(name)[0] ?? "");
	return "";
}

export async function createCaldavClient(): Promise<CaldavConnection> {
	const e = env();
	const client = await createDAVClient({
		serverUrl: "https://caldav.icloud.com",
		credentials: {
			username: e.ICLOUD_USERNAME,
			password: e.ICLOUD_APP_PASSWORD,
		},
		authMethod: "Basic",
		defaultAccountType: "caldav",
	});

	return {
		async listCalendars() {
			const calendars = await client.fetchCalendars();
			return calendars.map((c) => ({ displayName: displayNameOf(c.displayName), url: c.url }));
		},

		async fetchObjectsInWindow(calendarUrl, window) {
			const objects = await client.fetchCalendarObjects({
				calendar: { url: calendarUrl },
				timeRange: { start: window.startUtc, end: window.endUtc },
			});
			return objects.map((o) => ({ href: o.url, etag: o.etag ?? "", data: o.data ?? "" }));
		},

		async createObject(calendarUrl, filename, icalText) {
			await client.createCalendarObject({
				calendar: { url: calendarUrl },
				filename,
				iCalString: icalText,
			});
		},
	};
}
