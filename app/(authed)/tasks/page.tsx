import { Suspense } from "react";
import {
	Bone,
	CheckboxBone,
	DotBone,
	ListRow,
	PageSkeleton,
	repeat,
	SectionBone,
	StatBandBone,
	TextBone,
	TitleMetaBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { getCachedTaskBoard } from "@/lib/cache/tasks";
import { recentDoneSinceUtc, todayInTz } from "@/lib/dates";
import { quietProjectIdsOf } from "@/lib/quiet";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { NewTaskButton } from "./new-task-button";
import { TaskList } from "./task-list";

async function TasksBody({
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
	const { readAt, openTasks, doneTasks, domains, projects, people, taskNoteIds, taskMentions } =
		board;
	// The board already carries every project, so the quiet ones need no
	// second read (lib/quiet.ts). They stay off the store's clock: only Today
	// seeds those, beside the counts they were read with.
	const quietProjectIds = quietProjectIdsOf(projects);
	const snapshot: Snapshot = {
		readAt,
		todayIso,
		tz,
		views: [
			{ key: viewKey.tasks(), type: "taskLists", data: { open: openTasks, done: doneTasks } },
		],
	};

	return (
		// Header included: the count strip is the status filter, so it lives in
		// the client component that owns the filter state. The rows go to the
		// entity store, not to TaskList (#26).
		<Seed snapshot={snapshot}>
			<TaskList
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
				quietProjectIds={quietProjectIds}
			/>
		</Seed>
	);
}

// TaskRowItem's silhouette: checkbox, the held domain dot, title over meta,
// the star on the right.
function TaskRowBone({ i }: { i: number }) {
	return (
		<ListRow
			leading={
				<>
					<CheckboxBone />
					<DotBone />
				</>
			}
			trailing={<Bone className="size-4 rounded-sm" />}
		>
			<TitleMetaBone i={i} />
		</ListRow>
	);
}

function TasksFallback() {
	return (
		<PageSkeleton
			title="Tasks"
			// Disabled rather than absent: the page has exactly one standing
			// action and it is not data, so the slot is held. The dialog it opens
			// needs the domain list, which is what is still in flight.
			action={<NewTaskButton disabled />}
		>
			<StatBandBone count={3} />
			{/* The status strip on the left, the two scope selects on the right. */}
			<div
				aria-hidden="true"
				className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
			>
				<TextBone className="font-mono text-meta" width="w-64" />
				<TextBone className="font-mono text-meta" width="w-48" />
			</div>
			<SectionBone titleWidth="w-24">
				{repeat(3, (i) => (
					<TaskRowBone key={i} i={i} />
				))}
			</SectionBone>
			<SectionBone titleWidth="w-12">
				{repeat(6, (i) => (
					<TaskRowBone key={i} i={i + 3} />
				))}
			</SectionBone>
		</PageSkeleton>
	);
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child is where the entity store gets seeded (#26).
export default function TasksPage({
	searchParams,
}: {
	searchParams: Promise<{ edit?: string; status?: string; project?: string; domain?: string }>;
}) {
	return (
		<Suspense fallback={<TasksFallback />}>
			<TasksBody searchParams={searchParams} />
		</Suspense>
	);
}
