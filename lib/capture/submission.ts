// Pure helper for the palette's submit lifecycle, split out so the emptiness
// check is unit-testable without a DOM.

/**
 * Whether a draft is effectively empty. Trimming is used ONLY to decide
 * emptiness — the draft submitted to capture() is the verbatim, untrimmed text
 * (iron rule #5), so leading/trailing whitespace the user spoke or typed is
 * preserved.
 */
export function isBlank(text: string): boolean {
	return text.trim().length === 0;
}
