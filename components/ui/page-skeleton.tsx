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
 */
export function PageSkeleton({
	title,
	subtitle,
	rows = 6,
}: {
	title: string;
	subtitle?: string;
	rows?: number;
}) {
	return (
		<div>
			<PageHeader title={title} subtitle={subtitle} />
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
