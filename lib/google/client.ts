import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { type GoogleIcsFeed, parseGoogleIcsFeeds } from "@/lib/google/feeds";

// ─────────────────────────────────────────────────────────────────────────
// Google Calendar via secret ICS URLs (docs/adr/0018). No GCP / OAuth —
// owner pastes private iCal addresses from calendar settings. Network edge
// only; sync service is tested against GoogleCalendarConnection.
// ─────────────────────────────────────────────────────────────────────────

export type GoogleIcsObject = { etag: string; data: string };

/** Exactly what the sync service needs from Google ICS feeds. */
export type GoogleCalendarConnection = {
	listFeeds(): GoogleIcsFeed[];
	fetchFeed(url: string): Promise<GoogleIcsObject>;
};

function contentHash(body: string): string {
	return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export function createGoogleCalendarClient(): GoogleCalendarConnection {
	const feeds = parseGoogleIcsFeeds(env().GOOGLE_CALENDAR_ICS_FEEDS);

	return {
		listFeeds() {
			return feeds;
		},

		async fetchFeed(url) {
			const res = await fetch(url, {
				headers: { Accept: "text/calendar, text/plain, */*" },
				// Secret URLs are long-lived; no cookies / auth headers.
				redirect: "follow",
			});
			if (!res.ok) {
				throw new Error(`Google ICS fetch failed: ${res.status} ${url.slice(0, 60)}`);
			}
			const data = await res.text();
			const headerEtag = res.headers.get("etag")?.trim();
			const etag = headerEtag && headerEtag.length > 0 ? headerEtag : contentHash(data);
			return { etag, data };
		},
	};
}
