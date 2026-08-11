import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { SectionHead } from "./section-head";

/**
 * One group on a list page: section label, optional count, rows or empty.
 *
 * Encodes the rhythm every list settled on after Pass 2 / ADR-0046:
 * - `mt-9 first:mt-0` so peer groups share 36px and the first after the
 *   header does not double the header's own gap
 * - count on the title's baseline in mono meta (the same voice as the
 *   page header's measure figures)
 * - empty as a slot inside the section, never a free-floating message
 *
 * Freeform `aside` still wins over `count` when a surface needs a phrase
 * ("2 slots open") instead of a bare figure.
 */
export function ListSection({
	title,
	count,
	aside,
	children,
	empty,
	label,
}: {
	title: string;
	/** Right-aligned mono count. Omit rather than inventing zero for show. */
	count?: number;
	/** Overrides `count` when the right side is a phrase or a control. */
	aside?: ReactNode;
	children?: ReactNode;
	/** When set, replaces `children` with an EmptyState of this content. */
	empty?: ReactNode;
	/** `aria-label` when it should differ from the visible title. */
	label?: string;
}) {
	const right =
		aside ??
		(count !== undefined ? (
			<span className="font-mono text-meta tabular-nums text-ink-3">{count}</span>
		) : undefined);

	return (
		<section className="mt-9 first:mt-0" aria-label={label ?? title}>
			<SectionHead title={title} aside={right} />
			{empty != null ? <EmptyState>{empty}</EmptyState> : children}
		</section>
	);
}
