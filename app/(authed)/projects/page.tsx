import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { MoreBackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProjectBoard } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
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

	// The projects, the rows' open tasks and each row's done count read the
	// entity store (#30): a project created here, a task added from its row,
	// or a task finished anywhere shows at once.
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [
			{ key: viewKey.projects(), type: "projectList", data: { rows: projects } },
			{
				key: viewKey.projectBoardTasks(),
				type: "taskList",
				data: {
					rows: openTasks.filter((t) => t.project_id !== null),
					scope: { anyProject: true },
				},
			},
		],
		aggregates: Object.fromEntries(
			projects.map((p) => [`project.done:${p.id}`, taskCounts[p.id]?.done ?? 0]),
		),
	};

	return (
		<Seed snapshot={snapshot}>
			<ProjectList domains={domains} />
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
