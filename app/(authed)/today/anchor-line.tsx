import Link from "next/link";
import { formatInstant } from "@/lib/dates";
import type { AnchorData } from "@/lib/services/briefing";

/** The one-sentence commitments anchor: facts only, each clause a link. */
export function AnchorLine({ anchor, tz }: { anchor: AnchorData; tz: string }) {
	if (anchor.eventCount === 0 && anchor.openCount === 0) return null;

	return (
		<p className="mt-4 text-xs text-ink-2">
			{anchor.eventCount > 0 && (
				<span>
					{anchor.eventCount} event{anchor.eventCount === 1 ? "" : "s"} today
					{anchor.nextEvent &&
						` — next ${formatInstant(anchor.nextEvent.startAt, tz, "HH:mm")} ${anchor.nextEvent.title}`}
					{". "}
				</span>
			)}
			{anchor.openCount > 0 && (
				<Link href="/tasks" className="hover:underline">
					{anchor.openCount} task{anchor.openCount === 1 ? "" : "s"} open
					{anchor.overdueCount > 0 && (
						<>
							{" · "}
							<span className="text-accent">{anchor.overdueCount} overdue</span>
						</>
					)}
					.
				</Link>
			)}
		</p>
	);
}
