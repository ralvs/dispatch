// Pure helpers for the palette's submit lifecycle, split out so the guard and
// the emptiness check are unit-testable without a DOM.

/**
 * Guards an async completion against a superseded palette session. Each submit
 * takes a sequence number; if the current sequence has advanced by the time the
 * request resolves — a newer submit, or the palette was closed and reopened —
 * the result is stale and must not touch the UI (it would clobber a fresh
 * unsaved draft). The capture itself is already durable server-side.
 */
export function isStaleSubmission(submittedSeq: number, currentSeq: number): boolean {
	return submittedSeq !== currentSeq;
}

/**
 * Whether a draft is effectively empty. Trimming is used ONLY to decide
 * emptiness — the draft submitted to capture() is the verbatim, untrimmed text
 * (iron rule #5), so leading/trailing whitespace the user spoke or typed is
 * preserved.
 */
export function isBlank(text: string): boolean {
	return text.trim().length === 0;
}
