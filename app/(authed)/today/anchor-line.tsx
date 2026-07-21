import Link from "next/link";
import { formatInstant } from "@/lib/dates";
import type { AnchorData } from "@/lib/services/briefing";

/** The day at a glance: event count, the next one up, and open/overdue tasks. */
export function AnchorLine({ anchor, tz }: { anchor: AnchorData; tz: string }) {
	if (anchor.eventCount === 0 && anchor.openCount === 0) return null;

	return (
		<div>
			{anchor.eventCount > 0 && (
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					{anchor.eventCount} event{anchor.eventCount === 1 ? "" : "s"} today
				</p>
			)}
			{anchor.nextEvent && (
				<p className="mt-2 font-serif text-lg leading-snug text-ink">
					Next up at{" "}
					<span className="tabular-nums">
						{formatInstant(anchor.nextEvent.startAt, tz, "HH:mm")}
					</span>
					{" — "}
					{anchor.nextEvent.title}.
				</p>
			)}
			{anchor.openCount > 0 && (
				<p className="mt-2 font-mono text-meta text-ink-3">
					<Link href="/tasks" className="hover:underline">
						<span className="tabular-nums">{anchor.openCount}</span> open
						{anchor.overdueCount > 0 && (
							<>
								{" · "}
								<span className="text-accent">{anchor.overdueCount} overdue</span>
							</>
						)}
					</Link>
				</p>
			)}
		</div>
	);
}
