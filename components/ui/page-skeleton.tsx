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
 * The actions are the opposite case and take the opposite rule. A standing
 * action is not data — the route knows it exists before the query returns,
 * exactly as it knows its own name — so leaving the slot empty would pop a
 * control into the header the moment data landed. Pass it disabled: the
 * control is there, it is simply not ready yet (DESIGN.md, "The Invisible Slot
 * Rule").
 */
export function PageSkeleton({
	title,
	titleAction,
	subtitle,
	action,
	rows = 6,
}: {
	title: string;
	/** The route's title-side action, rendered disabled. Holds its slot. */
	titleAction?: ReactNode;
	subtitle?: string;
	/** The route's right-hand standing action, rendered disabled. Holds its slot. */
	action?: ReactNode;
	rows?: number;
}) {
	return (
		<div>
			<PageHeader title={title} titleAction={titleAction} subtitle={subtitle} action={action} />
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
