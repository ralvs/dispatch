import type { ReactNode } from "react";
import { EmptyState } from "./empty-state";
import { SectionHead } from "./section-head";

/**
 * One group on a list page: section label, optional count, rows or empty.
 *
 * Encodes the rhythm every list settled on after Pass 2 / ADR-0046:
 * - `mt-9 first:mt-0` so peer groups share 36px and the first after the
 *   header does not double the header's own gap
 * - count sits beside the title (SectionHead), mono meta, not far-right
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
	/** Mono count next to the title. Omit rather than inventing zero for show. */
	count?: number;
	/** Overrides `count` when the trailing bit is a phrase or a control. */
	aside?: ReactNode;
	children?: ReactNode;
	/** When set, replaces `children` with an EmptyState of this content. */
	empty?: ReactNode;
	/** `aria-label` when it should differ from the visible title. */
	label?: string;
}) {
	const trailing =
		aside ??
		(count !== undefined ? (
			<span className="font-mono text-meta tabular-nums text-ink-4">{count}</span>
		) : undefined);

	return (
		<section className="mt-9 first:mt-0" aria-label={label ?? title}>
			<SectionHead title={title} aside={trailing} />
			{empty != null ? <EmptyState>{empty}</EmptyState> : children}
		</section>
	);
}
