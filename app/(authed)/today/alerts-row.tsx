import Link from "next/link";

/**
 * Things waiting on a decision, as opposed to the cadence strip's counts of
 * the day's workload: tasks with no domain, notes the parser could not place,
 * and links still unread.
 */
export function AlertsRow({
	triage,
	needsReview,
	linksUnread,
}: {
	triage: number;
	needsReview: number;
	linksUnread: number;
}) {
	const alerts = [
		{ key: "triage", count: triage, label: "awaiting triage", href: "/triage" },
		{ key: "review", count: needsReview, label: "need review", href: "/notes" },
		{ key: "links", count: linksUnread, label: "unread links", href: "/links" },
	].filter((a) => a.count > 0);

	if (alerts.length === 0) return null;

	return (
		<section aria-label="Alerts awaiting decision">
			<ul className="flex flex-wrap gap-2 lg:justify-end">
				{alerts.map((alert) => (
					<li key={alert.key}>
						<Link
							href={alert.href}
							className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1.5 font-mono text-meta hover:border-ink-3 hover:bg-surface-2"
						>
							<span className="tabular-nums text-accent">{alert.count}</span>
							<span className="text-ink-2">{alert.label}</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
