import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { getAppTimezone } from "@/lib/services/settings";
import { listRecentDone, listTasks } from "@/lib/services/tasks";
import { TaskList } from "./task-list";

export default async function TasksPage() {
	const { sb } = await requireOwnerPage();
	const [tz, openTasks, doneTasks, domains] = await Promise.all([
		getAppTimezone(sb),
		listTasks(sb, { status: "open" }),
		listRecentDone(sb, 10),
		listDomains(sb),
	]);
	const todayIso = todayInTz(tz);
	const inboxCount = openTasks.filter((t) => t.domain?.name === "Inbox").length;

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Tasks</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The docket</h1>
				{inboxCount > 0 && (
					<Link href="/triage" className="mt-2 inline-block text-meta text-accent-ink">
						{inboxCount} in the Inbox domain awaiting triage →
					</Link>
				)}
			</header>

			<TaskList openTasks={openTasks} doneTasks={doneTasks} todayIso={todayIso} domains={domains} />
		</div>
	);
}
