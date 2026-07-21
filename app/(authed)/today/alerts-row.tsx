import Link from "next/link";

/**
 * Things waiting on a decision, as opposed to the cadence strip's counts of
 * the day's workload: tasks with no domain, notes the parser could not place,
 * and links still unread.
 */
export function AlertsRow({
	triage,
	needsReview,
	ingestUnread,
}: {
	triage: number;
	needsReview: number;
	ingestUnread: number;
}) {
	const alerts = [
		{ key: "triage", count: triage, label: "awaiting triage", href: "/triage" },
		{ key: "review", count: needsReview, label: "need review", href: "/notes" },
		{ key: "ingest", count: ingestUnread, label: "unread links", href: "/ingest" },
	].filter((a) => a.count > 0);

	if (alerts.length === 0) return null;

	return (
		<section aria-label="Alerts awaiting decision">
			<h2 className="hairline-strong pb-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3">
				Awaiting decision
			</h2>
			<ul>
				{alerts.map((alert) => (
					<li key={alert.key} className="hairline">
						<Link href={alert.href} className="flex items-center justify-between gap-3 py-3">
							<span className="flex items-center gap-2">
								<span className="font-mono tabular-nums text-accent">{alert.count}</span>
								<span className="text-ink-2">{alert.label}</span>
							</span>
							<span aria-hidden="true" className="text-ink-4">
								→
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
