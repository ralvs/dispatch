import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { getAppTimezone } from "@/lib/services/settings";
import { listTasks } from "@/lib/services/tasks";
import { TaskForm } from "./task-form";
import { TaskRowItem } from "./task-row";

export default async function TasksPage() {
	const { sb } = await requireOwnerPage();
	const [tz, openTasks, doneTasks, domains] = await Promise.all([
		getAppTimezone(sb),
		listTasks(sb, { status: "open" }),
		listTasks(sb, { status: "done" }),
		listDomains(sb),
	]);
	const todayIso = todayInTz(tz);
	const inboxCount = openTasks.filter((t) => t.domain?.name === "Inbox").length;
	const recentDone = doneTasks.slice(0, 10);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Tasks</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The docket</h1>
				{inboxCount > 0 && (
					<Link href="/inbox" className="mt-2 inline-block text-meta text-accent-ink">
						{inboxCount} in the inbox awaiting triage →
					</Link>
				)}
			</header>

			<section className="mt-6">
				<TaskForm domains={domains} />
			</section>

			<section className="mt-6" aria-label="Open tasks">
				{openTasks.length === 0 ? (
					<p className="py-8 text-center font-serif italic text-ink-3">
						Nothing on the docket. Capture something.
					</p>
				) : (
					<ul>
						{openTasks.map((t) => (
							<TaskRowItem key={t.id} task={t} todayIso={todayIso} />
						))}
					</ul>
				)}
			</section>

			{recentDone.length > 0 && (
				<section className="mt-10" aria-label="Recently completed">
					<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
						Recently done
					</h2>
					<ul className="mt-2">
						{recentDone.map((t) => (
							<TaskRowItem key={t.id} task={t} todayIso={todayIso} />
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
