import { type MentionCandidate, normalizeName } from "@/lib/mentions";
import { createSuggestionExtension } from "./suggestion-extension";

/**
 * Builds the `@` mention autocomplete extension for a given note's editor.
 * `people` is read on every keystroke: the pool changes after the editor is
 * built when a person is created in this tab (#30).
 */
export function createMentionSuggestionExtension(people: () => MentionCandidate[]) {
	return createSuggestionExtension<MentionCandidate>({
		name: "mentionSuggestion",
		char: "@",
		items: people,
		// Matching uses the same normalizeName the task-side autocomplete and the
		// save-time resolver use (docs/adr/0030), so "what the dropdown offers"
		// and "what a plain @Name would resolve to" never disagree.
		matches: (candidate, query) => normalizeName(candidate.name).includes(normalizeName(query)),
		label: (item) => item.name,
		emptyLabel: "No matching people",
		toNode: (item) => ({ type: "mention", attrs: { id: item.id, name: item.name } }),
	});
}
