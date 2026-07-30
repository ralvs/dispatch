import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { listMentionsForSources } from "@/lib/services/mentions";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { listMentionCandidates } from "@/lib/services/people";
import { listProjects } from "@/lib/services/projects";
import { getAppTimezone } from "@/lib/services/settings";
import { listRecentDone, listTasks } from "@/lib/services/tasks";
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
	const [tz, openTasks, doneTasks, domains, projects, people] = await Promise.all([
		getAppTimezone(sb),
		listTasks(sb, { status: "open" }),
		// Only the "Recently done" band consumes these — there is no Done filter
		// to page through, so ten is the whole appetite.
		listRecentDone(sb, 10),
		listDomains(sb),
		listProjects(sb),
		listMentionCandidates(sb),
	]);
	const todayIso = todayInTz(tz);
	const inboxCount = openTasks.filter((t) => t.domain_id === null).length;
	const allTaskIds = [...openTasks, ...doneTasks].map((t) => t.id);
	const [taskNoteIds, taskMentions] = await Promise.all([
		listNoteIdsForTargets(sb, "task", allTaskIds).then((rows) => Object.fromEntries(rows)),
		listMentionsForSources(sb, "task", allTaskIds).then((map) =>
			Object.fromEntries(
				[...map.entries()].map(([id, persons]) => [
					id,
					persons.map((p) => ({ id: p.id, name: p.name })),
				]),
			),
		),
	]);

	return (
		// Header included: the count strip is the status filter, so it lives in
		// the client component that owns the filter state.
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
			people={people}
			taskMentions={taskMentions}
			inboxCount={inboxCount}
		/>
	);
}
