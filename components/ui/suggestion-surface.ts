/**
 * Shared surface for the three suggestion popovers (mention-input, note
 * @-mention, note wikilink). Pass 5: one style, three callers — state models
 * differ (caret-driven vs TipTap plugins; people vs note titles ± create), so
 * the surface is shared and the components are not. Same call day-row and
 * task-row made.
 *
 * Options are names a person wrote → sans. Empty is the app speaking → quiet
 * roman at ink-4, not the EmptyState italic (this is a floating menu, not a
 * page band).
 */
export const suggestionPanel =
	"rounded-control border border-line-strong bg-surface py-1 elevation-overlay";

export const suggestionEmpty =
	"rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink-4 elevation-overlay";

export function suggestionOption(selected: boolean): string {
	return `block w-full truncate px-3 py-1.5 text-left text-sm active:opacity-70 ${
		selected ? "bg-accent-bg text-accent-ink" : "text-ink-2 hover:bg-surface-2"
	}`;
}
