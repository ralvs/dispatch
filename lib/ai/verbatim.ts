// ─────────────────────────────────────────────────────────────────────────
// The last line of defence on a parsed title.
//
// Every prompt in this directory asks for the title "verbatim in the language
// spoken", and a prompt is the only thing holding that promise — nothing
// downstream ever checked. The failure it lets through is not a bad guess but
// an invented one: a capture of "home: Ask refunds today" was stored as "Ask
// Heff Hounds", a title sharing one word with what was typed. A wrong date can
// be fixed in a second because the task still says what it is; a title made of
// words the user never said is unrecoverable, because nothing on screen points
// back at the thing they meant.
//
// So the rule here is not "is this title good" — it is "did these words come
// from the user". A title that fails it is replaced by the raw text, which is
// never elegant and never wrong. Every other parsed field is kept: a
// hallucinated title does not make the domain or the due date suspect, and
// throwing them away would trade one small loss for three.
//
// Deliberately NOT a similarity score. A threshold invites tuning, and the
// question has a yes/no answer.
// ─────────────────────────────────────────────────────────────────────────

/** Lowercased, de-accented word tokens. Punctuation is a separator, not a word. */
function tokens(s: string): string[] {
	return s
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

/**
 * Shortest length at which a prefix match is evidence of inflection rather
 * than coincidence. Below it, three-letter English and Portuguese words share
 * prefixes constantly ("do"/"dog", "ver"/"verde") and the guard would start
 * accepting invented words.
 */
const INFLECTION_MIN = 4;

/**
 * A title word counts as spoken when the utterance has it exactly, or has a
 * word it shares a stem with. The second arm exists because a model rendering
 * a title is allowed to inflect — "ask refunds" written back as "ask refund",
 * "marcar" as "marcarei" — and failing those would send perfectly good titles
 * back to raw text several times a day.
 */
function spoken(word: string, source: string[]): boolean {
	return source.some(
		(t) =>
			t === word ||
			(word.length >= INFLECTION_MIN &&
				t.length >= INFLECTION_MIN &&
				(t.startsWith(word) || word.startsWith(t))),
	);
}

/**
 * True when every word of `title` was said in `text`. Dropping words is fine
 * and expected — the parser strips a "home:" prefix and a trailing "today" on
 * purpose — so this asks only that nothing was ADDED.
 */
export function isVerbatim(title: string, text: string): boolean {
	const source = tokens(text);
	const candidate = tokens(title);
	// A title with no words at all (emoji, punctuation) says nothing about the
	// utterance either way; the schema's min(1) already rejects the empty case.
	if (candidate.length === 0) return true;
	return candidate.every((w) => spoken(w, source));
}

/**
 * The title to store: the model's when it is made of the user's own words, the
 * user's raw text when it is not. Returns the reason so the caller can log a
 * substitution — a silent guard is one nobody finds out is misfiring.
 */
export function guardTitle(title: string, text: string): { title: string; substituted: boolean } {
	if (isVerbatim(title, text)) return { title, substituted: false };
	return { title: text.trim(), substituted: true };
}
