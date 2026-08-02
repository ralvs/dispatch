import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { getCachedTaskBoard } from "@/lib/cache/tasks";
import { todayInTz } from "@/lib/dates";
import { TaskList } from "./task-list";

export default async function TasksPage({
	searchParams,
}: {
	searchParams: Promise<{ edit?: string; status?: string; project?: string; domain?: string }>;
}) {
	// The security boundary stays here (iron rule #2). The cached read below
	// runs on the service-role client and must never precede it.
	await requireOwnerPage();
	const {
		edit: editTaskId,
		status: initialStatus,
		project: initialProjectId,
		domain: initialDomainId,
	} = await searchParams;

	// searchParams only seed the client filter state — every one of them filters
	// inside TaskList — so they are deliberately not part of the cache key.
	const [tz, board] = await Promise.all([getCachedAppTimezone(), getCachedTaskBoard()]);
	const { openTasks, doneTasks, domains, projects, people, taskNoteIds, taskMentions } = board;

	// Derived per request, not cached: an entry that survived midnight would
	// otherwise paint yesterday's overdue set.
	const todayIso = todayInTz(tz);
	const inboxCount = openTasks.filter((t) => t.domain_id === null).length;

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
