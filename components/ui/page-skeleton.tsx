import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

/**
 * What a route shows while its data is in flight.
 *
 * It renders the real `PageHeader`, because the header is the one thing the
 * route already knows before the query returns — the page's name is not data.
 * That also removes the failure this replaces: every `loading.tsx` used to
 * restate its page's header by hand, so a header change had to be made twice
 * per route and silently drifted when it wasn't.
 *
 * The measure is deliberately absent. It is a count, the count is the data, and
 * a placeholder figure would be the one thing on screen that lies.
 *
 * `action` is the opposite case and takes the opposite rule. A standing action
 * is not data — the route knows it exists before the query returns, exactly as
 * it knows its own name — so leaving the slot empty would pop a control into
 * the header the moment data landed. Pass it disabled: the control is there,
 * it is simply not ready yet (DESIGN.md, "The Invisible Slot Rule").
 *
 * `title` is optional for the one case where the page's name *is* data: a
 * detail route renders `person.name`, so there is no name to state yet. Those
 * two routes used to pass the noun — `title="Person"` — which made the h1 say
 * one thing and then another, the exact pop the action rule exists to prevent,
 * and reinstated the eyebrow word ADR-0042 deleted. Omit it and the placeholder
 * renders inside the real h1, where it cannot drift from the title's geometry.
 */
function TitlePlaceholder() {
	return (
		<>
			<span className="sr-only">Loading</span>
			{/* inline-block, so the h1's line box still comes from its own strut and
			    the header keeps the height it will have once the name arrives. */}
			<span
				aria-hidden="true"
				className="inline-block h-[0.66em] w-[min(60%,18rem)] animate-pulse rounded bg-surface align-baseline"
			/>
		</>
	);
}

export function PageSkeleton({
	title,
	subtitle,
	action,
	rows = 6,
}: {
	/** Omit on a detail route, where the title is data rather than the page. */
	title?: string;
	subtitle?: string;
	/** The route's standing action, rendered disabled. Holds its slot. */
	action?: ReactNode;
	rows?: number;
}) {
	return (
		<div>
			<PageHeader title={title ?? <TitlePlaceholder />} subtitle={subtitle} action={action} />
			<span role="status" className="sr-only">
				Loading
			</span>
			<div className="space-y-3" aria-hidden="true">
				{Array.from({ length: rows }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder rows, never reordered.
					<div key={i} className="h-4 animate-pulse rounded bg-surface" />
				))}
			</div>
		</div>
	);
}
