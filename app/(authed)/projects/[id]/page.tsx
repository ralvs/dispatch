import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import {
	BackLink,
	Bone,
	CheckboxBone,
	HeaderCreateButton,
	ListRow,
	PageSkeleton,
	PillBone,
	ragged,
	repeat,
	TextBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProject } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { ProjectDetail } from "./project-detail";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const parsedId = z.uuid().safeParse((await params).id);
	if (!parsedId.success) return {};
	// Security boundary first (iron rule #2). Same cached read as the page, so
	// no extra round trip; a missing project leaves the default title and the
	// page's notFound() decides the 404.
	await requireOwnerPage();
	const detail = await getCachedProject(parsedId.data);
	return detail ? { title: detail.project.name } : {};
}

async function ProjectBody({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [detail, domains, tz] = await Promise.all([
		getCachedProject(id),
		getCachedDomains(true),
		getCachedAppTimezone(),
	]);
	if (!detail) notFound();
	const { readAt, project, tasks, projects } = detail;

	const todayIso = todayInTz(tz);
	const snapshot: Snapshot = {
		readAt,
		todayIso,
		tz,
		views: [
			{
				key: viewKey.projectHead(project.id),
				type: "projectList",
				data: { rows: [project], scope: { id: project.id } },
			},
			{
				key: viewKey.project(project.id),
				type: "taskList",
				data: { rows: tasks, scope: { projectId: project.id } },
			},
		],
	};

	return (
		<Seed snapshot={snapshot}>
			<ProjectDetail
				projectId={project.id}
				projects={projects.map((p) => ({ id: p.id, name: p.name, domain_id: p.domain_id }))}
				domains={domains}
				todayIso={todayIso}
			/>
		</Seed>
	);
}

// ProjectDetail's silhouette: the name with its status and domain, the
// start/target dates, the EDIT / MARK DONE / ARCHIVE pills, then the Tasks
// section — progress bar and checkbox rows. No title: this route's h1 is the
// project's name, which is the data still in flight. The + is not data —
// hold its slot disabled.
function ProjectFallback() {
	return (
		<PageSkeleton
			measure={["w-12", "w-20"]}
			subtitle={<TextBone className="inline-flex" width="w-24" />}
			action={<HeaderCreateButton label="Add task" disabled />}
		>
			<div aria-hidden="true">
				<div className="grid grid-cols-2 gap-2 text-sm">
					{repeat(2, (i) => (
						<div key={i}>
							<TextBone className="font-mono text-eyebrow" width="w-20" />
							<TextBone width="w-24" />
						</div>
					))}
				</div>
				<div className="mt-3 flex flex-wrap gap-2">
					<PillBone width="w-14" />
					<PillBone width="w-[98px]" />
					<PillBone width="w-20" />
				</div>
				<section className="mt-9">
					<div className="mb-1.5 flex items-baseline gap-2">
						<TextBone className="type-section" width="w-14" />
					</div>
					<Bone className="mt-2 h-1.5 w-full" />
					<ul className="mt-3">
						{repeat(5, (i) => (
							<ListRow key={i} leading={<CheckboxBone />}>
								<TextBone className="text-base leading-[1.35]" width={ragged(i)} />
							</ListRow>
						))}
					</ul>
				</section>
			</div>
		</PageSkeleton>
	);
}

// The data streams in behind the page's own boundary, so the route keeps no
// loading.tsx (#21). `params` is handed down unawaited: awaiting it here would
// make the whole page one dynamic hole again. The breadcrumb is not data, so it
// sits above the boundary and comes out of the prerendered shell.
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	return (
		<div>
			<BackLink href="/projects" label="Projects" />
			<Suspense fallback={<ProjectFallback />}>
				<ProjectBody params={params} />
			</Suspense>
		</div>
	);
}
