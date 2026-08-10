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

/**
 * Chrome only. Every floating piece here carries it; nothing renders it twice,
 * which is why it is a base rather than a fourth export.
 */
const suggestionChrome = "rounded-control border border-line-strong bg-surface elevation-overlay";

export const suggestionPanel = `${suggestionChrome} py-1`;

/**
 * The empty line's copy, without chrome — for a dropdown that renders the
 * panel itself and puts the empty state inside it (mention-input).
 */
export const suggestionEmptyText = "px-3 py-2 text-sm text-ink-4";

/**
 * A standalone empty state: the copy plus its own chrome, for menus that
 * render the empty case *instead of* the panel (the two TipTap plugins).
 */
export const suggestionEmpty = `${suggestionChrome} ${suggestionEmptyText}`;

export function suggestionOption(selected: boolean): string {
	return `block w-full truncate px-3 py-1.5 text-left text-sm active:opacity-70 ${
		selected ? "bg-accent-bg text-accent-ink" : "text-ink-2 hover:bg-surface-2"
	}`;
}
