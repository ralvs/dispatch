// Parse GOOGLE_CALENDAR_ICS_FEEDS env (docs/adr/0018).
// Format: Name|url;Name2|url2  (semicolon-separated pairs)

export type GoogleIcsFeed = { name: string; url: string };

/**
 * Parse feed list from env. Empty / whitespace → [].
 * Each entry is `Name|https://…/basic.ics`. Names may contain spaces;
 * URLs must not contain `;` or unescaped `|`.
 */
export function parseGoogleIcsFeeds(raw: string | undefined): GoogleIcsFeed[] {
	if (!raw?.trim()) return [];
	const feeds: GoogleIcsFeed[] = [];
	for (const part of raw.split(";")) {
		const entry = part.trim();
		if (!entry) continue;
		const bar = entry.indexOf("|");
		if (bar <= 0 || bar === entry.length - 1) {
			throw new Error(
				`Invalid GOOGLE_CALENDAR_ICS_FEEDS entry (want Name|url): ${entry.slice(0, 80)}`,
			);
		}
		const name = entry.slice(0, bar).trim();
		const url = entry.slice(bar + 1).trim();
		if (!name || !url.startsWith("https://")) {
			throw new Error(
				`Invalid GOOGLE_CALENDAR_ICS_FEEDS entry (https URL required): ${entry.slice(0, 80)}`,
			);
		}
		feeds.push({ name, url });
	}
	return feeds;
}
