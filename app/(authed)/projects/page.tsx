import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProjectBoard } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import type { TaskRow } from "@/lib/schemas/task";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot, ViewSeed } from "@/lib/store/types";
import { ProjectList } from "./project-list";

async function ProjectsBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	// Open tasks for the inline lists (plan O5) come with the board: one read
	// for the whole page rather than one per row.
	const [{ readAt, projects, openTasks, taskCounts }, domains, tz] = await Promise.all([
		getCachedProjectBoard(),
		getCachedDomains(true),
		getCachedAppTimezone(),
	]);

	const openByProject = new Map<string, TaskRow[]>();
	for (const task of openTasks) {
		if (task.project_id === null) continue;
		const bucket = openByProject.get(task.project_id);
		if (bucket) bucket.push(task);
		else openByProject.set(task.project_id, [task]);
	}
	// The projects and each row's open tasks read the entity store (#30): a
	// project created here, or a task added from its row, shows at once.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [
			{ key: viewKey.projects(), type: "projectList", data: { rows: projects } },
			...projects.map(
				(p): ViewSeed => ({
					key: viewKey.projectRowTasks(p.id),
					type: "taskList",
					data: { rows: openByProject.get(p.id) ?? [], scope: { projectId: p.id } },
				}),
			),
		],
	};
	// Done counts at read time. A task finished since is in the row's view as
	// done, and the row adds it (project-list.tsx).
	const doneAtRead = Object.fromEntries(
		Object.entries(taskCounts).map(([id, counts]) => [id, counts.done]),
	);

	return (
		<Seed snapshot={snapshot}>
			<ProjectList domains={domains} doneAtRead={doneAtRead} />
		</Seed>
	);
}

function ProjectsFallback() {
	return (
		<PageSkeleton
			title="Projects"
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<CreateTrigger label="New project" disabled />}
		/>
	);
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child seeds the entity store (#30).
export default function ProjectsPage() {
	return (
		<div>
			<MoreBackLink />
			<Suspense fallback={<ProjectsFallback />}>
				<ProjectsBody />
			</Suspense>
		</div>
	);
}
