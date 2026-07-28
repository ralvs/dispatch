import Link from "next/link";

/**
 * Shared @mention chip styling (docs/adr/0030 §4) — matches the note-link
 * chip on task rows so both "linked to a note" and "mentions a person" read
 * as the same family of small cross-reference glyphs. Exported as a plain
 * class string, not just the React component, because the note-side
 * TipTap `Mention` node renders raw HTML (see mention-extension.ts) and has
 * no React tree to mount into.
 */
export const MENTION_CHIP_CLASS =
	"inline-flex shrink-0 items-center gap-1 rounded border border-line px-1 py-px text-[10px] leading-none text-ink-3 hover:border-line-strong hover:text-ink";

/** A single "@Name" chip linking to /people/[id] — the task-row rendering of a mention. */
export function MentionChip({ id, name }: { id: string; name: string }) {
	return (
		<Link
			href={`/people/${id}`}
			className={MENTION_CHIP_CLASS}
			onClick={(e) => e.stopPropagation()}
		>
			@{name}
		</Link>
	);
}
