import "server-only";
import { env } from "@/lib/env";
import type { GoogleRemoteEvent } from "@/lib/google/map-event";

// ─────────────────────────────────────────────────────────────────────────
// Thin Google Calendar API v3 client (docs/adr/0018). Network edge only —
// lib/services/google-calendar.ts is tested against GoogleCalendarConnection.
// Scope: calendar.readonly. No email or other Google APIs.
// ─────────────────────────────────────────────────────────────────────────

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarConnection = {
	listCalendars(): Promise<{ id: string; summary: string }[]>;
	listEventsInWindow(
		calendarId: string,
		window: { startUtc: string; endUtc: string },
	): Promise<GoogleRemoteEvent[]>;
};

async function refreshAccessToken(): Promise<string> {
	const e = env();
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: e.GOOGLE_CLIENT_ID ?? "",
			client_secret: e.GOOGLE_CLIENT_SECRET ?? "",
			refresh_token: e.GOOGLE_REFRESH_TOKEN ?? "",
			grant_type: "refresh_token",
		}),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => "");
		throw new Error(`Google token refresh failed: ${res.status} ${body.slice(0, 200)}`);
	}
	const json = (await res.json()) as { access_token?: string };
	if (!json.access_token) {
		throw new Error("Google token refresh returned no access_token");
	}
	return json.access_token;
}

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

export async function createGoogleCalendarClient(): Promise<GoogleCalendarConnection> {
	const accessToken = await refreshAccessToken();

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
