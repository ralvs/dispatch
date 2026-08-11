import { displayTitle } from "@/lib/note-display";
import { sanitizeLabel } from "@/lib/wikilinks";
import { createSuggestionExtension } from "./suggestion-extension";

export type WikilinkCandidate = { id: string; title: string | null; body: string };

/** Builds the `[[` wikilink autocomplete extension for a given note's editor. */
export function createWikilinkSuggestionExtension(
	noteTitles: WikilinkCandidate[],
	currentNoteId: string,
) {
	return createSuggestionExtension<WikilinkCandidate>({
		name: "wikilinkSuggestion",
		char: "[[",
		items: noteTitles,
		// A note never links to itself; an empty query offers everything else.
		matches: (candidate, query) => {
			if (candidate.id === currentNoteId) return false;
			if (query === "") return true;
			return displayTitle(candidate).toLowerCase().includes(query.toLowerCase());
		},
		label: displayTitle,
		emptyLabel: "No matching notes",
		toNode: (item) => ({
			type: "wikilink",
			attrs: { id: item.id, label: sanitizeLabel(displayTitle(item)) },
		}),
	});
}
