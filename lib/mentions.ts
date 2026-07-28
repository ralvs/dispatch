// @mention People (docs/adr/0030). Two parse paths deliberately, matching
// the syntax split in Decision 2:
//   - notes store a structured `@[uuid|Name]` wikilink-style token, parsed
//     by uuid (see lib/wikilinks.ts, the template for this half).
//   - task titles/notes store plain `@Name`, resolved against a candidate
//     index built from the people list — longest-name-first, never guessing
//     an ambiguous match (Decision 3).
// Client-safe: no "server-only" import, used by both the task-side
// autocomplete (browser) and the save/executor paths (server).

const UUID_SOURCE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

/**
 * Matches `@[uuid|Name]`. Name is anything but `]`, `|`, or a newline.
 * Exported (mirroring `WIKILINK_RE` in lib/wikilinks.ts) so the note editor's
 * `Mention` TipTap node can parse the same token at the markdown-it level.
 */
export const MENTION_TOKEN_RE = new RegExp(`@\\[(${UUID_SOURCE})\\|([^\\]|\\n]+)\\]`, "g");

// Word character for the "preceded by a word char" email guard — unicode
// letters/numbers/underscore, so accented names count as word chars too.
const WORD_CHAR_RE = /[\p{L}\p{N}_]/u;

// Trailing punctuation stripped off a candidate join before lookup.
const TRAILING_PUNCT_RE = /[,.;:!?)]+$/;

const MAX_MENTION_TOKENS = 5;

export type MentionCandidate = { id: string; name: string };
export type MentionIndex = { byName: Map<string, string[]>; maxWords: number };
export type MentionMatch = { personId: string; name: string; start: number; end: number };

/** NFD + lowercase name normalization — same rule as lib/services/capture/resolve.ts's `normalize`. */
export function normalizeName(s: string): string {
	return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Builds the lookup index extractMentions matches against: normalized name -> person ids, plus the longest name's word count. */
export function buildMentionIndex(people: MentionCandidate[]): MentionIndex {
	const byName = new Map<string, string[]>();
	let maxWords = 0;

	for (const person of people) {
		const norm = normalizeName(person.name);
		if (!norm) continue;

		const wordCount = norm.split(/\s+/).filter(Boolean).length;
		if (wordCount > maxWords) maxWords = wordCount;

		const ids = byName.get(norm);
		if (ids) {
			if (!ids.includes(person.id)) ids.push(person.id);
		} else {
			byName.set(norm, [person.id]);
		}
	}

	return { byName, maxWords };
}

/** All person ids referenced by `@[uuid|Name]` tokens in `markdown`, deduped, first-appearance order. */
export function extractMentionPersonIds(markdown: string): string[] {
	const ids: string[] = [];
	const seen = new Set<string>();
	for (const match of markdown.matchAll(MENTION_TOKEN_RE)) {
		const id = match[1];
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		ids.push(id);
	}
	return ids;
}

/**
 * All `@[uuid|Name]` tokens in `markdown` as `{personId, name}` pairs — first
 * appearance wins per id, matching `extractMentionPersonIds`. Feeds
 * `syncMentions`, which wants the verbatim `matched_name` alongside each id.
 */
export function extractMentionMatches(markdown: string): { personId: string; name: string }[] {
	const matches: { personId: string; name: string }[] = [];
	const seen = new Set<string>();
	for (const match of markdown.matchAll(MENTION_TOKEN_RE)) {
		const id = match[1];
		const name = match[2];
		if (id === undefined || name === undefined || seen.has(id)) continue;
		seen.add(id);
		matches.push({ personId: id, name });
	}
	return matches;
}

/** Strips `|`, `[`, `]`, and newlines; collapses whitespace; falls back to "Unknown". */
function sanitizeMentionName(name: string): string {
	const cleaned = name
		.replace(/[|[\]]/g, "")
		.replace(/\s+/g, " ")
		.trim();
	return cleaned || "Unknown";
}

/** Serializes a note mention to its markdown source, sanitizing the display name. */
export function serializeMention(id: string, name: string): string {
	return `@[${id}|${sanitizeMentionName(name)}]`;
}

/** Blanks fenced ``` blocks and inline `backtick` spans to same-length whitespace, preserving all other offsets. */
function blankCodeSpans(text: string): string {
	const blank = (m: string) => m.replace(/[^\n]/g, " ");
	return text.replace(/```[\s\S]*?```/g, blank).replace(/`[^`\n]*`/g, blank);
}

function isValidPrecedingChar(prev: string | undefined): boolean {
	if (prev === undefined) return true;
	if (prev === "." || prev === "@") return false;
	return !WORD_CHAR_RE.test(prev);
}

type TokenMatch = { personId: string; name: string; end: number };

/**
 * From `pos` (just after an `@`), tries joins of up to `cap` whitespace-
 * separated tokens on the current line, longest first, stripping trailing
 * punctuation before lookup. First hit wins — including an ambiguous one,
 * which resolves to nothing rather than falling back to a shorter join.
 */
function matchTokensAt(
	text: string,
	pos: number,
	index: MentionIndex,
	cap: number,
): TokenMatch | null {
	const newlineIdx = text.indexOf("\n", pos);
	const lineEnd = newlineIdx === -1 ? text.length : newlineIdx;
	const line = text.slice(pos, lineEnd);

	const tokens = [...line.matchAll(/\S+/g)].slice(0, cap);
	if (tokens.length === 0) return null;

	const first = tokens[0];
	if (!first || first.index === undefined) return null;

	for (let k = tokens.length; k >= 1; k--) {
		const last = tokens[k - 1];
		if (!last || last.index === undefined) continue;

		const rawEnd = last.index + last[0].length;
		const raw = line.slice(first.index, rawEnd);
		const stripped = raw.replace(TRAILING_PUNCT_RE, "");
		if (stripped.length === 0) continue;

		const norm = normalizeName(stripped);
		const ids = index.byName.get(norm);
		if (!ids) continue;

		if (ids.length !== 1) return null; // ambiguous — never guess, and don't fall back further
		const personId = ids[0];
		if (!personId) return null;
		return { personId, name: stripped, end: pos + first.index + stripped.length };
	}

	return null;
}

/**
 * Plain `@Name` mentions in `text`, resolved against `index`. An `@` counts
 * only when preceded by start-of-string or a non-word char that isn't `.` or
 * `@` (so `renan@alves.id` is never a mention). Fenced/backtick code spans
 * are ignored entirely.
 */
export function extractMentions(text: string, index: MentionIndex): MentionMatch[] {
	const cap = Math.min(index.maxWords, MAX_MENTION_TOKENS);
	if (cap === 0) return [];

	const cleaned = blankCodeSpans(text);
	const matches: MentionMatch[] = [];

	let i = 0;
	while (i < cleaned.length) {
		if (cleaned[i] === "@" && isValidPrecedingChar(i > 0 ? cleaned[i - 1] : undefined)) {
			const found = matchTokensAt(text, i + 1, index, cap);
			if (found) {
				matches.push({ personId: found.personId, name: found.name, start: i, end: found.end });
				i = found.end;
				continue;
			}
		}
		i++;
	}

	return matches;
}

/**
 * The active `@name` query at `caret`, for autocomplete. Looks back on the
 * current line only (a newline always closes a query) for the nearest valid
 * `@`. Spaces stay inside the query — names have them.
 */
export function activeMentionQuery(
	value: string,
	caret: number,
): { query: string; start: number } | null {
	const upto = value.slice(0, caret);
	const lineStart = upto.lastIndexOf("\n") + 1;

	let at = -1;
	for (let idx = upto.length - 1; idx >= lineStart; idx--) {
		if (upto[idx] === "@") {
			at = idx;
			break;
		}
	}
	if (at === -1) return null;
	if (!isValidPrecedingChar(at > 0 ? value[at - 1] : undefined)) return null;

	return { query: value.slice(at + 1, caret), start: at };
}

/**
 * Replaces the in-progress `@query` at `[start, caret)` with the accepted
 * name, returning the new text and where the caret should land.
 *
 * Pure and exported so the "@" survives: `start` is the index OF the "@", so
 * the replacement has to re-emit it. Writing back a bare name would leave
 * plain "Thais" in the text, and `extractMentions` only matches an
 * "@"-prefixed name — the accepted suggestion would record no mention at all.
 */
export function spliceMention(
	value: string,
	start: number,
	caret: number,
	name: string,
): { value: string; caret: number } {
	const before = value.slice(0, start);
	const after = value.slice(caret);
	const inserted = `@${name} `;
	return { value: `${before}${inserted}${after}`, caret: before.length + inserted.length };
}
