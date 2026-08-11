import type { ReactNode } from "react";

/**
 * A section's heading inside a page: the group label on a list, the title on a
 * Today card.
 *
 * Quiet on purpose — `ink-3` at the section size, not full `ink`. The rows
 * below carry the content weight; the group label only names the band. Putting
 * it at the same strength as a row title made every "Active" / "Open" shout as
 * loud as the items under it.
 *
 * `aside` (a count, a slot reading, a quiet control) sits **next to the
 * title on the left**, not pinned to the far right. A figure eight columns
 * away from its label is unreadable as a pair.
 *
 * Promoted out of app/(authed)/today/day-bands.tsx, where it was private to
 * Today and is the shipped precedent.
 */
export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
	return (
		<div className="mb-1.5 flex items-baseline gap-2">
			<h2 className="m-0 type-section text-ink-3">{title}</h2>
			{aside}
		</div>
	);
}
