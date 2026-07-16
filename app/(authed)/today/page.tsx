import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { formatDay, formatInstant, todayInTz } from "@/lib/dates";
import { getBriefing } from "@/lib/services/briefing";
import { getAppTimezone } from "@/lib/services/settings";
import { TaskRowItem } from "../tasks/task-row";

export default async function TodayPage() {
	const { sb } = await requireOwnerPage();
	const tz = await getAppTimezone(sb);
	const todayIso = todayInTz(tz);
	const briefing = await getBriefing(sb, tz, todayIso);

	return (
		<div>
			<header className="hairline-strong flex items-baseline justify-between pb-5">
				<div>
					<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Dispatch · Daily edition
					</p>
					<h1 className="mt-1 font-serif text-4xl text-ink">{formatDay(todayIso, tz)}</h1>
				</div>
				<Link href="/chat" className="font-mono text-meta text-ink-3 hover:text-ink-2">
					Ask →
				</Link>
			</header>

			{briefing.cadence.length > 0 && (
				<section className="hairline flex flex-wrap gap-x-8 gap-y-3 py-4" aria-label="Cadence">
					{briefing.cadence.map((line) => (
						<Link key={line.key} href={line.href} className="block">
							<span
								className={`block font-serif text-2xl ${line.slip ? "text-accent-slip" : "text-ink"}`}
							>
								{line.big}
							</span>
							<span className="font-mono text-meta uppercase tracking-widest text-ink-3">
								{line.label}
							</span>
						</Link>
					))}
				</section>
			)}

			{briefing.inboxCount > 0 && (
				<Link
					href="/inbox"
					className="hairline mt-4 block py-3 font-mono text-meta uppercase tracking-widest text-accent-ink"
				>
					{briefing.inboxCount} capture{briefing.inboxCount === 1 ? "" : "s"} awaiting triage →
				</Link>
			)}

			<section className="mt-6" aria-label="Doing today">
				<div className="flex items-baseline justify-between">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Doing today
					</h2>
					<Link href="/tasks" className="font-mono text-meta text-ink-4 hover:text-ink-2">
						All tasks →
					</Link>
				</div>
				{briefing.doingToday.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						A clear slate. Star tasks or set due dates to shape the day.
					</p>
				) : (
					<ul className="mt-2">
						{briefing.doingToday.map((t) => (
							<TaskRowItem key={t.id} task={t} todayIso={todayIso} />
						))}
					</ul>
				)}
			</section>

			{briefing.todayEvents.length > 0 && (
				<section className="mt-6" aria-label="Today's calendar">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
						Today's calendar
					</h2>
					<ul className="mt-2">
						{briefing.todayEvents.map((event) => (
							<li
								key={event.id}
								className="hairline flex items-baseline justify-between gap-3 py-2.5"
							>
								<div className="min-w-0 flex-1">
									<p className="text-sm text-ink">{event.title}</p>
									{event.calendar_name && (
										<p className="mt-0.5 font-mono text-meta text-ink-4">
											{event.calendar_name}
											{event.location ? ` · ${event.location}` : ""}
										</p>
									)}
								</div>
								<span className="shrink-0 font-mono text-meta text-ink-3">
									{event.all_day
										? "all day"
										: `${formatInstant(event.start_at, tz, "HH:mm")}–${formatInstant(event.end_at, tz, "HH:mm")}`}
								</span>
							</li>
						))}
					</ul>
				</section>
			)}

			{briefing.routines.total > 0 && (
				<section className="mt-6" aria-label="Routines today">
					<div className="flex items-baseline justify-between">
						<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							Routines today
						</h2>
						<Link href="/routines" className="font-mono text-meta text-ink-4 hover:text-ink-2">
							All routines →
						</Link>
					</div>
					<p className="mt-2 font-serif text-xl text-ink">
						{briefing.routines.done}/{briefing.routines.total} done
					</p>
					{briefing.routines.remainingNames.length > 0 && (
						<ul className="mt-1 font-mono text-meta text-ink-4">
							{briefing.routines.remainingNames.map((name) => (
								<li key={name}>{name}</li>
							))}
						</ul>
					)}
				</section>
			)}

			{briefing.quoteOfDay && (
				<Link href="/quotes" className="mt-6 block" aria-label="Resurfaced quote">
					<section>
						<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
							Resurfaced
						</p>
						<blockquote className="mt-2 font-serif text-2xl italic text-ink">
							“{briefing.quoteOfDay.text}”
						</blockquote>
						{(briefing.quoteOfDay.source_author || briefing.quoteOfDay.source_reference) && (
							<p className="mt-2 font-mono text-meta text-ink-3">
								{briefing.quoteOfDay.source_author ?? briefing.quoteOfDay.source_reference}
							</p>
						)}
					</section>
				</Link>
			)}
		</div>
	);
}
