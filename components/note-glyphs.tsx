/**
 * The three note affordances that appear on a row: the task's own notes
 * field, a linked note record, and creating one. They sit side by side in the
 * same schedule bands, so they share a size, a stroke and a chip shell here
 * rather than drifting apart in the two files that render them.
 *
 * Icon-only, so every call site owes its control an aria-label.
 */

function Glyph({ children }: { children: React.ReactNode }) {
	return (
		<svg
			viewBox="0 0 16 16"
			width="14"
			height="14"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="h-3.5 w-3.5"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

/** Bare text lines — the notes written *on* the task, not a record of their own. */
export function IconNoteLines() {
	return <Glyph>{<path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5" />}</Glyph>;
}

/** A page with a folded corner — a note that exists as its own record. */
export function IconNoteDoc() {
	return (
		<Glyph>
			<path d="M9 2.5H4.5v11h7V5z" />
			<path d="M9 2.5V5h2.5" />
			<path d="M6.5 8.5h3M6.5 11h3" />
		</Glyph>
	);
}

/** The same page, still to be written. */
export function IconNoteDocPlus() {
	return (
		<Glyph>
			<path d="M9 2.5H4.5v11h7V5z" />
			<path d="M9 2.5V5h2.5" />
			<path d="M8 7.5v4M6 9.5h4" />
		</Glyph>
	);
}

/**
 * Shared shell for the three glyphs above: a quiet bordered square that reads
 * as a control at a glance without competing with the row's title.
 *
 * The after: pseudo-element carries the hit area (14px vertically, past the
 * 44px minimum once the box is counted; 4px horizontally, which is what lets
 * two of these sit a gap-2 apart without their targets overlapping).
 */
export const NOTE_CHIP_CLASS =
	"relative inline-flex shrink-0 items-center justify-center rounded border border-line p-1 leading-none text-ink-3 after:absolute after:-inset-y-3.5 after:-inset-x-1 after:content-[''] hover:border-line-strong hover:text-ink active:opacity-70";
