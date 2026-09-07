// Pure ranking and snippet helpers for Find. The service queries; this
// module decides which field hit and how the row is ordered. Kept free of
// "server-only" so the tests do not need a database.

export const FIND_MIN_QUERY = 2;
export const FIND_GROUP_CAP = 8;
export const FIND_RECENTS = 5;
/** Fetch a wider window so ranking is not just "newest 8 that matched". */
export const FIND_FETCH_CAP = 24;

export function escapeLike(q: string): string {
	return q.replace(/[%_\\]/g, (m) => `\\${m}`);
}

/** Strip characters that would split a PostgREST `or()` filter. */
export function sanitizeFindQuery(q: string): string {
	return q.replace(/[,()]/g, " ").replace(/\s+/g, " ").trim();
}

export function haystackHas(haystack: string | null | undefined, query: string): boolean {
	if (!haystack) return false;
	return haystack.toLowerCase().includes(query.toLowerCase());
}

/**
 * ~80 characters around the first case-insensitive match, markdown-ish
 * punctuation stripped so a snippet never shows `**` or a colour span.
 */
export function snippetAround(haystack: string, query: string, radius = 40): string | null {
	const lower = haystack.toLowerCase();
	const needle = query.toLowerCase();
	const at = lower.indexOf(needle);
	if (at < 0) return null;
	const start = Math.max(0, at - radius);
	const end = Math.min(haystack.length, at + needle.length + radius);
	let slice = haystack.slice(start, end).replace(/\s+/g, " ").trim();
	slice = slice.replace(/[#*_`[\]<>]/g, "");
	if (start > 0) slice = `…${slice}`;
	if (end < haystack.length) slice = `${slice}…`;
	return slice || null;
}

export function taskScore(input: {
	title: string;
	notes: string | null;
	status: "open" | "done";
	query: string;
}): number {
	let score = 0;
	if (haystackHas(input.title, input.query)) score += 3;
	if (haystackHas(input.notes, input.query)) score += 1;
	if (input.status === "open") score += 0.5;
	return score;
}

export function noteScore(input: {
	title: string | null;
	body: string;
	needsReview: boolean;
	query: string;
}): number {
	let score = 0;
	if (haystackHas(input.title, input.query)) score += 3;
	if (haystackHas(input.body, input.query)) score += 1;
	if (input.needsReview) score += 0.5;
	return score;
}

export function taskField(title: string, query: string): "title" | "notes" {
	return haystackHas(title, query) ? "title" : "notes";
}

export function noteField(title: string | null, query: string): "title" | "body" {
	return haystackHas(title, query) ? "title" : "body";
}
