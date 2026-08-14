import type { DayScheduleItem } from "@/lib/day-schedule";

/**
 * The sentence at the top of the day, and it follows the day the nav is on —
 * one word apart between today and anywhere else.
 *
 *   today, something ahead     Next up at 14:00 — Almoço com a Ana.
 *   any other day              First up at 09:30 — Retro do sprint.
 *   today, nothing left        You are free.
 *   any other day, empty       Nothing on the clock.
 *
 * "Next" is a claim about the clock and only today has one, so an empty other
 * day cannot say "You are free" — it does not know yet.
 *
 * The subject renders in ink-4 behind the ink lead-in. The eye lands on the
 * time first, which is what you came to the page for; the title is the answer
 * to a question you have already asked.
 */
export function headlineFor(
	timeline: DayScheduleItem[],
	isToday: boolean,
	nowUtcIso: string,
): { lead: string; subject: string | null } {
	const timed = timeline.filter((item) => item.time !== null);
	const upcoming = isToday
		? timed.find((item) => Date.parse(item.sortAt) >= Date.parse(nowUtcIso))
		: timed[0];

	if (!upcoming) {
		return { lead: isToday ? "You are free." : "Nothing on the clock.", subject: null };
	}
	const title = upcoming.kind === "event" ? upcoming.event.title : upcoming.task.title;
	return {
		lead: `${isToday ? "Next" : "First"} up at ${upcoming.time} — `,
		subject: `${title}.`,
	};
}

export function DayHeadline({
	timeline,
	isToday,
	nowUtcIso,
}: {
	timeline: DayScheduleItem[];
	isToday: boolean;
	nowUtcIso: string;
}) {
	const { lead, subject } = headlineFor(timeline, isToday, nowUtcIso);

	return (
		// max-w in ch, not px: the measure is what keeps the line breaking on the
		// em-dash rather than mid-title, and that holds at 36px and at 56px.
		<h1 className="t-day-owned m-0 max-w-[16ch] text-t36 text-ink lg:text-hero">
			<span className="tabular-nums">{lead}</span>
			{subject && <span className="text-ink-4">{subject}</span>}
		</h1>
	);
}
