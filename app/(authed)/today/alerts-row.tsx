import Link from "next/link";
import { Badge } from "@/components/ui";

/**
 * Things waiting on a decision, as opposed to the cadence strip's counts of
 * the day's workload: tasks with no domain, notes the parser could not place,
 * and links still unread.
 */
export function AlertsRow({
	inbox,
	needsReview,
	linksUnread,
}: {
	inbox: number;
	needsReview: number;
	linksUnread: number;
}) {
	const alerts = [
		{ key: "inbox", count: inbox, label: "in the inbox", href: "/inbox", tone: "accent" as const },
		{
			key: "review",
			count: needsReview,
			label: "need review",
			href: "/notes",
			tone: "warning" as const,
		},
		{
			key: "links",
			count: linksUnread,
			label: "unread links",
			href: "/links",
			tone: "accent" as const,
		},
	].filter((a) => a.count > 0);

	if (alerts.length === 0) return null;

	return (
		<section aria-label="Alerts awaiting decision">
			{/* One chip per line, right-aligned: a stack reads as a short list of
			    outstanding decisions rather than a row of tags. */}
			<ul className="flex flex-col items-end gap-2">
				{alerts.map((alert) => (
					<li key={alert.key}>
						<Link href={alert.href} className="no-underline">
							<Badge tone={alert.tone}>
								<span className="tabular-nums">{alert.count}</span> {alert.label}
							</Badge>
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
