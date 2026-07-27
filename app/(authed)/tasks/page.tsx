import Link from "next/link";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { listProjects } from "@/lib/services/projects";
import { getAppTimezone } from "@/lib/services/settings";
import { listRecentDone, listTasks } from "@/lib/services/tasks";
import { isDueToday, isOverdue } from "@/lib/task-predicates";
import { TaskList } from "./task-list";

export default async function TasksPage({
	searchParams,
}: {
	searchParams: Promise<{ edit?: string; status?: string; project?: string; domain?: string }>;
}) {
	const { sb } = await requireOwnerPage();
	const {
		edit: editTaskId,
		status: initialStatus,
		project: initialProjectId,
		domain: initialDomainId,
	} = await searchParams;
	const [tz, openTasks, doneTasks, domains, projects] = await Promise.all([
		getAppTimezone(sb),
		listTasks(sb, { status: "open" }),
		// Bumped from 10: the Done filter needs something to page through, not
		// just the header strip's recent handful.
		listRecentDone(sb, 100),
		listDomains(sb),
		listProjects(sb),
	]);
	const todayIso = todayInTz(tz);
	const inboxCount = openTasks.filter((t) => t.domain_id === null).length;
	const overdueCount = openTasks.filter((t) => isOverdue(t, todayIso)).length;
	const dueTodayCount = openTasks.filter((t) => isDueToday(t, todayIso)).length;
	const taskNoteIds = Object.fromEntries(
		await listNoteIdsForTargets(
			sb,
			"task",
			[...openTasks, ...doneTasks].map((t) => t.id),
		),
	);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Tasks</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">The docket</h1>
				<p className="mt-1 font-mono text-meta text-ink-3">
					{openTasks.length} open ·{" "}
					<span className={overdueCount > 0 ? "text-accent-slip" : undefined}>
						{overdueCount} overdue
					</span>{" "}
					· {dueTodayCount} today
				</p>
				{inboxCount > 0 && (
					<Link href="/inbox" className="mt-2 inline-block text-meta text-accent-ink">
						{inboxCount} in the inbox →
					</Link>
				)}
			</header>

			<TaskList
				openTasks={openTasks}
				doneTasks={doneTasks}
				todayIso={todayIso}
				domains={domains}
				projects={projects}
				editTaskId={editTaskId ?? null}
				initialStatus={initialStatus}
				initialProjectId={initialProjectId}
				initialDomainId={initialDomainId}
				taskNoteIds={taskNoteIds}
				tz={tz}
			/>
		</div>
	);
}
