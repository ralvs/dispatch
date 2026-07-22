import "server-only";
import type { GoogleRemoteEvent } from "@/lib/google/map-event";
import { refreshAccessToken } from "@/lib/google/oauth";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar API v3 client (docs/adr/0018). Network edge only.
// Scope: calendar.readonly. No email or other Google APIs.
// ─────────────────────────────────────────────────────────────────────────

const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarConnection = {
	listCalendars(): Promise<{ id: string; summary: string }[]>;
	listEventsInWindow(
		calendarId: string,
		window: { startUtc: string; endUtc: string },
	): Promise<GoogleRemoteEvent[]>;
};

async function googleGet<T>(accessToken: string, url: string): Promise<T> {
	const res = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Google Calendar API ${res.status}: ${body.slice(0, 200)}`);
	}
	return (await res.json()) as T;
}

export async function createGoogleCalendarClient(
	refreshToken: string,
): Promise<GoogleCalendarConnection> {
	const accessToken = await refreshAccessToken(refreshToken);

	return {
		async listCalendars() {
			type ListRes = {
				items?: { id?: string; summary?: string }[];
				nextPageToken?: string;
			};
			const calendars: { id: string; summary: string }[] = [];
			let pageToken: string | undefined;
			do {
				const params = new URLSearchParams({ minAccessRole: "reader" });
				if (pageToken) params.set("pageToken", pageToken);
				const data = await googleGet<ListRes>(
					accessToken,
					`${CAL_BASE}/users/me/calendarList?${params}`,
				);
				for (const item of data.items ?? []) {
					if (!item.id) continue;
					calendars.push({
						id: item.id,
						summary: item.summary?.trim() || item.id,
					});
				}
				pageToken = data.nextPageToken;
			} while (pageToken);
			return calendars;
		},

		async listEventsInWindow(calendarId, window) {
			type ListRes = {
				items?: GoogleRemoteEvent[];
				nextPageToken?: string;
			};
			const events: GoogleRemoteEvent[] = [];
			let pageToken: string | undefined;
			do {
				const params = new URLSearchParams({
					timeMin: window.startUtc,
					timeMax: window.endUtc,
					singleEvents: "true",
					orderBy: "startTime",
					showDeleted: "true",
					maxResults: "2500",
				});
				if (pageToken) params.set("pageToken", pageToken);
				const data = await googleGet<ListRes>(
					accessToken,
					`${CAL_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
				);
				for (const item of data.items ?? []) {
					if (item?.id) events.push(item);
				}
				pageToken = data.nextPageToken;
			} while (pageToken);
			return events;
		},
	};
}
