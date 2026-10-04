import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import {
	DotBone,
	ListRow,
	MoreBackLink,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	SectionBone,
	TextBone,
	TitleMetaBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProjectBoard } from "@/lib/cache/projects";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
import { ProjectList } from "./project-list";

async function ProjectsBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	// Open tasks for the inline lists (plan O5) come with the board: one read
	// for the whole page rather than one per row.
	const [read, domains, clock] = await Promise.all([
		getCachedProjectBoard(),
		getCachedDomains(true),
		readClock(),
	]);
	const { projects, openTasks, taskCounts } = read.data;

	// The projects, the rows' open tasks and each row's done count read the
	// entity store (#30): a project created here, a task added from its row,
	// or a task finished anywhere shows at once.
	const snapshot = seedOf(read, clock, {
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
	});

	return (
		<Seed snapshot={snapshot}>
			<ProjectList domains={domains} />
		</Seed>
	);
}

// ProjectList's silhouette: the Active group of board rows — dot, name over
// meta, the first open tasks beneath, the ADD TASK pill on the right.
function ProjectsFallback() {
	return (
		<PageSkeleton
			title="Projects"
			measure={["w-16", "w-16"]}
			// Disabled rather than absent — create is not data (PageSkeleton).
			action={<CreateTrigger label="New project" disabled />}
		>
			<div>
				<SectionBone titleWidth="w-14">
					{repeat(5, (i) => (
						<ListRow
							key={i}
							align="start"
							leading={<DotBone />}
							trailing={<PillBone width="w-[88px]" />}
						>
							<TitleMetaBone i={i} />
							<div className="mt-1.5 space-y-0.5">
								{repeat(i % 3 === 1 ? 1 : 2, (j) => (
									<TextBone key={j} className="text-sm" width={ragged(i + j + 2)} />
								))}
							</div>
						</ListRow>
					))}
				</SectionBone>
			</div>
		</PageSkeleton>
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
