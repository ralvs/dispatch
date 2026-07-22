// Pure Google Calendar API event → local row fields (docs/adr/0018).
// No network here — fully unit-tested with fixtures.

export type GoogleRemoteEvent = {
	id: string;
	etag: string;
	status?: string;
	summary?: string | null;
	description?: string | null;
	location?: string | null;
	htmlLink?: string | null;
	start?: { dateTime?: string; date?: string; timeZone?: string };
	end?: { dateTime?: string; date?: string; timeZone?: string };
	attendees?: { email?: string; displayName?: string }[] | null;
};

export type MappedGoogleEvent = {
	uid: string;
	etag: string;
	href: string | null;
	title: string;
	description: string | null;
	location: string | null;
	startUtc: string;
	endUtc: string;
	allDay: boolean;
	attendees: string[];
};

/** YYYY-MM-DD → UTC midnight ISO for that calendar date. */
function dateOnlyToUtcMidnight(date: string): string {
	const [y, m, d] = date.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d)).toISOString();
}

/** Timed Google dateTime (offset or Z) → UTC ISO. */
function dateTimeToUtcIso(dateTime: string): string {
	return new Date(dateTime).toISOString();
}

/**
 * Map one Google event into upsert fields, or null if it should not land
 * in the DB (cancelled / missing id / unparseable times).
 */
export function mapGoogleEvent(event: GoogleRemoteEvent): MappedGoogleEvent | null {
	if (!event.id) return null;
	if (event.status === "cancelled") return null;

	const start = event.start;
	const end = event.end;
	if (!start || !end) return null;

	let startUtc: string;
	let endUtc: string;
	let allDay: boolean;

	if (start.date && end.date) {
		// All-day: Google end.date is exclusive (day after last day).
		allDay = true;
		startUtc = dateOnlyToUtcMidnight(start.date);
		endUtc = dateOnlyToUtcMidnight(end.date);
	} else if (start.dateTime && end.dateTime) {
		allDay = false;
		startUtc = dateTimeToUtcIso(start.dateTime);
		endUtc = dateTimeToUtcIso(end.dateTime);
	} else {
		return null;
	}

	const attendees = (event.attendees ?? [])
		.map((a) => a.email ?? a.displayName ?? null)
		.filter((v): v is string => Boolean(v));

	return {
		uid: event.id,
		etag: event.etag ?? "",
		href: event.htmlLink ?? null,
		title: event.summary?.trim() || "(no title)",
		description: event.description ?? null,
		location: event.location ?? null,
		startUtc,
		endUtc,
		allDay,
		attendees,
	};
}
