import "server-only";
import { createDAVClient } from "tsdav";
import { env } from "@/lib/env";
import { ServiceError } from "@/lib/services/errors";

// ─────────────────────────────────────────────────────────────────────────
// Thin wrapper over tsdav (docs/adr/0006). Not unit-tested — this is the
// network edge; lib/services/calendar.ts is tested against the narrow
// CaldavConnection interface below, stubbed.
// ─────────────────────────────────────────────────────────────────────────

export type CaldavCalendarObject = { href: string; etag: string; data: string };

/** Where a written object now lives. `etag` is null when the server sent none. */
export type CaldavWritten = { href: string; etag: string | null };

/** Exactly what the calendar service needs from a CalDAV connection. */
export type CaldavConnection = {
	listCalendars(): Promise<{ displayName: string; url: string }[]>;
	fetchObjectsInWindow(
		calendarUrl: string,
		window: { startUtc: string; endUtc: string },
	): Promise<CaldavCalendarObject[]>;
	/** One object by its href, or null when the server no longer has it. */
	fetchObject(href: string): Promise<CaldavCalendarObject | null>;
	createObject(calendarUrl: string, filename: string, icalText: string): Promise<CaldavWritten>;
	/**
	 * Replace the object only if it still carries `etag` (If-Match). A newer
	 * copy on the server throws a CONFLICT ServiceError instead of being lost.
	 */
	updateObject(href: string, icalText: string, etag: string): Promise<CaldavWritten>;
	/** Delete under the same If-Match rule. An object already gone is not an error. */
	deleteObject(href: string, etag: string): Promise<void>;
};

/** The 412 an If-Match write gets when someone changed the object first. */
export function changedSinceSyncError(): ServiceError {
	return new ServiceError(
		"This event changed in iCloud since the last sync. Sync, then try again.",
		"CONFLICT",
	);
}

async function failOn(res: Response, what: string): Promise<void> {
	if (res.ok) return;
	if (res.status === 412) throw changedSinceSyncError();
	throw new ServiceError(`iCloud refused to ${what} the event (HTTP ${res.status})`, null);
}

/** The collection an object sits in: its href minus the file name. */
function collectionOf(href: string): string {
	return new URL(".", href).href;
}

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

		async fetchObject(href) {
			return fetchOne(href);
		},

		async createObject(calendarUrl, filename, icalText) {
			const res = await client.createCalendarObject({
				calendar: { url: calendarUrl },
				filename,
				iCalString: icalText,
			});
			await failOn(res, "create");
			const href = new URL(filename, calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`)
				.href;
			return { href, etag: await etagAfterWrite(res, href) };
		},

		async updateObject(href, icalText, etag) {
			const res = await client.updateCalendarObject({
				calendarObject: { url: href, data: icalText, etag },
			});
			await failOn(res, "update");
			return { href, etag: await etagAfterWrite(res, href) };
		},

		async deleteObject(href, etag) {
			const res = await client.deleteCalendarObject({ calendarObject: { url: href, etag } });
			if (res.status === 404) return;
			await failOn(res, "delete");
		},
	};

	async function fetchOne(href: string): Promise<CaldavCalendarObject | null> {
		const objects = await client.fetchCalendarObjects({
			calendar: { url: collectionOf(href) },
			objectUrls: [href],
		});
		const path = new URL(href).pathname;
		const found = objects.find((o) => o.data && new URL(o.url).pathname === path);
		return found ? { href: found.url, etag: found.etag ?? "", data: found.data } : null;
	}

	/**
	 * The new etag, so the next edit can send If-Match without a sync first.
	 * A PUT may answer without one (RFC 4791 lets a server change the data);
	 * then read it back. Null only when even that fails.
	 */
	async function etagAfterWrite(res: Response, href: string): Promise<string | null> {
		const header = res.headers.get("etag");
		if (header) return header;
		try {
			return (await fetchOne(href))?.etag || null;
		} catch {
			return null;
		}
	}
}
