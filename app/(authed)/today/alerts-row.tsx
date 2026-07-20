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
		{ key: "ingest", count: ingestUnread, label: "unread", href: "/ingest" },
	].filter((a) => a.count > 0);

	if (alerts.length === 0) return null;

	return (
		<section className="mt-5" aria-label="Alerts">
			<ul className="flex flex-wrap gap-2">
				{alerts.map((alert) => (
					<li key={alert.key}>
						<Link
							href={alert.href}
							className="flex items-baseline gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-accent hover:text-ink"
						>
							<span className="text-accent tabular-nums">{alert.count}</span>
							{alert.label}
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
