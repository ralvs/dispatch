import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { formatDay, todayInTz } from "@/lib/dates";
import { getAppTimezone } from "@/lib/services/settings";
import { listInboxTasks, listTasks } from "@/lib/services/tasks";
import { TaskRowItem } from "../tasks/task-row";

// Phase 1 skeleton of the briefing: masthead + doing-today list + inbox
// strip. The full editorial composition (cadence lines, resurfaced quote,
// events, routines) lands in Phase 6.
export default async function TodayPage() {
	const { sb } = await requireOwnerPage();
	const [tz, open, inbox] = await Promise.all([
		getAppTimezone(sb),
		listTasks(sb, { status: "open" }),
		listInboxTasks(sb),
	]);
	const todayIso = todayInTz(tz);

	const top3 = open.filter((t) => t.top3_for_date === todayIso);
	const dueOrOverdue = open.filter(
		(t) => t.top3_for_date !== todayIso && t.due_date !== null && t.due_date <= todayIso,
	);
	const doingToday = [...top3, ...dueOrOverdue].slice(0, 10);

	return (
		<div>
			<header className="hairline-strong pb-5">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Dispatch · Daily edition
				</p>
				<h1 className="mt-1 font-serif text-4xl text-ink">{formatDay(todayIso, tz)}</h1>
			</header>

			{inbox.length > 0 && (
				<Link
					href="/inbox"
					className="hairline mt-4 block py-3 font-mono text-meta uppercase tracking-widest text-accent-ink"
				>
					{inbox.length} capture{inbox.length === 1 ? "" : "s"} awaiting triage →
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
				{doingToday.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						A clear slate. Star tasks or set due dates to shape the day.
					</p>
				) : (
					<ul className="mt-2">
						{doingToday.map((t) => (
							<TaskRowItem key={t.id} task={t} todayIso={todayIso} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
