// ─────────────────────────────────────────────────────────────────────────
// Fuzzy name matching for capture routing (docs/adr/0016, 0061). The parser
// may answer a project or domain with the short phrase the user said — "the
// apartment" — instead of the exact list name "Apartment move", and this
// finds the row it means.
//
// Ported from the reference's apps/api/src/lib/match.ts: an exact hit scores
// 1, a whole-phrase substring 0.6–0.9 by length ratio, word overlap up to
// 0.55, threshold 0.5. Two changes, both from cases the reference gets wrong:
//
//   - Filler words ("the", "my", "o", "do", …) are dropped first. Without
//     that, "the apartment" is neither a substring of "Apartment move" nor
//     half its words, and scores 0.275.
//   - A tie for the best score is no match. The reference takes the first
//     row, which files the task under whichever project the query happened
//     to list first. Ambiguous is unresolved, and unresolved is reported.
//
// Pure: no I/O. resolveTaskRouting decides WHEN fuzzy matching is allowed.
// ─────────────────────────────────────────────────────────────────────────

const THRESHOLD = 0.5;

// Words that carry no name. English and pt-BR, since captures are either.
const FILLER = new Set([
	"the",
	"a",
	"an",
	"my",
	"our",
	"that",
	"this",
	"o",
	"os",
	"as",
	"um",
	"uma",
	"do",
	"da",
	"dos",
	"das",
	"de",
	"meu",
	"minha",
	"nosso",
	"nossa",
]);

function words(s: string): string[] {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.split(/[^\p{L}\p{N}]+/u)
		.filter((w) => w && !FILLER.has(w));
}

/** 0–1: how well `query` names `target`. */
export function matchScore(query: string, target: string): number {
	const q = words(query).join(" ");
	const t = words(target).join(" ");
	if (!q || !t) return 0;
	if (q === t) return 1;
	if (t.includes(q) || q.includes(t)) {
		const lenRatio = Math.min(q.length, t.length) / Math.max(q.length, t.length);
		return 0.6 + 0.3 * lenRatio;
	}
	const qWords = new Set(q.split(" ").filter((w) => w.length > 2));
	const tWords = new Set(t.split(" ").filter((w) => w.length > 2));
	if (qWords.size === 0 || tWords.size === 0) return 0;
	let hits = 0;
	for (const w of qWords) if (tWords.has(w)) hits += 1;
	return (hits / qWords.size) * 0.55;
}

/**
 * The one candidate `phrase` names, or null when none scores at least 0.5 or
 * two share the best score.
 */
export function bestMatch<T extends { name: string }>(phrase: string, candidates: T[]): T | null {
	let best: T | null = null;
	let bestScore = 0;
	let tied = false;
	for (const c of candidates) {
		const score = matchScore(phrase, c.name);
		if (score > bestScore) {
			best = c;
			bestScore = score;
			tied = false;
		} else if (score === bestScore && score > 0) {
			tied = true;
		}
	}
	if (bestScore < THRESHOLD || tied) return null;
	return best;
}
