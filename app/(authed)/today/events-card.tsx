import { formatInstant } from "@/lib/dates";
import type { CalendarEventRow } from "@/lib/services/calendar";

const EVENT_CAP = 4;

export function EventsCard({ events, tz }: { events: CalendarEventRow[]; tz: string }) {
	if (events.length === 0) return null;
	const shown = events.slice(0, EVENT_CAP);
	const more = events.length - shown.length;

	return (
		<section aria-label="Today's events">
			<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
				Today · {events.length} event{events.length === 1 ? "" : "s"}
			</h2>
			<ul className="mt-2">
				{shown.map((event) => (
					<li key={event.id} className="flex items-baseline gap-3 border-b border-line py-2.5">
						<span className="w-12 shrink-0 font-mono text-meta tabular-nums text-ink-3">
							{event.all_day ? "—" : formatInstant(event.start_at, tz, "HH:mm")}
						</span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-[13px] text-ink">{event.title}</p>
							{(event.calendar_name || event.location) && (
								<p className="mt-0.5 truncate font-mono text-meta text-ink-4">
									{event.calendar_name ?? ""}
									{event.calendar_name && event.location ? " · " : ""}
									{event.location ?? ""}
								</p>
							)}
						</div>
					</li>
				))}
			</ul>
			{more > 0 && <p className="mt-2 font-mono text-meta text-ink-4">+ {more} more</p>}
		</section>
	);
}
