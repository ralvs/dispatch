// The http(s) links written into free text, in order, each once. Trailing
// sentence punctuation is not part of a link.
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/gi;

export function extractUrls(...texts: (string | null | undefined)[]): string[] {
	const seen = new Set<string>();
	for (const text of texts) {
		for (const raw of text?.match(URL_IN_TEXT) ?? []) {
			seen.add(raw.replace(/[.,;:!?)\]}]+$/, ""));
		}
	}
	return [...seen];
}
