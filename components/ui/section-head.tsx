import type { ReactNode } from "react";

/**
 * A section's heading inside a page: the group label on a list, the title on a
 * Today card. Body size at 500 with the display tracking — the size/colour
 * split does the hierarchical work, so a heading can sit at 16px and still read
 * as one (DESIGN.md, Typography).
 *
 * `aside` rides its baseline on the right: a count, a slot reading, a quiet
 * control.
 *
 * Promoted verbatim out of app/(authed)/today/day-bands.tsx, where it was
 * private to Today and is the shipped precedent.
 */
export function SectionHead({
	title,
	aside,
	className = "",
}: {
	title: string;
	aside?: ReactNode;
	className?: string;
}) {
	return (
		<div className={`mb-1.5 flex items-baseline justify-between gap-4 ${className}`}>
			<h2 className="m-0 text-base font-medium tracking-[-0.02em] text-ink">{title}</h2>
			{aside}
		</div>
	);
}
