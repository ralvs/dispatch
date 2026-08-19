import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { getCachedTaskBoard } from "@/lib/cache/tasks";
import { recentDoneSinceUtc, todayInTz } from "@/lib/dates";
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
	// Timezone first: the done-window floor is a cache key, so it has to be
	// computed before the board read rather than in parallel with it.
	const tz = await getCachedAppTimezone();
	const todayIso = todayInTz(tz);
	const board = await getCachedTaskBoard(recentDoneSinceUtc(todayIso, tz));
	const { openTasks, doneTasks, domains, projects, people, taskNoteIds, taskMentions } = board;

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
