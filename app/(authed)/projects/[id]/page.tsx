import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { HeaderCreateButton, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProject } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { AddTaskButton } from "../add-task-button";
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
	const { project, tasks, projects } = detail;

	const todayIso = todayInTz(tz);

	return (
		<ProjectDetail
			project={project}
			tasks={tasks}
			domains={domains}
			todayIso={todayIso}
			addTask={
				<AddTaskButton
					project={{ id: project.id, name: project.name, domain_id: project.domain_id }}
					domainId={project.domain_id}
					projects={projects.map((p) => ({ id: p.id, name: p.name, domain_id: p.domain_id }))}
					domains={domains.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
					todayIso={todayIso}
				/>
			}
		/>
	);
}

function ProjectFallback() {
	return (
		// No title: this route's h1 is the project's name, which is the data
		// still in flight. The + is not data — hold its slot disabled.
		<PageSkeleton rows={5} action={<HeaderCreateButton label="Add task" disabled />} />
	);
}

// The data streams in behind the page's own boundary, so the route keeps no
// loading.tsx (#21). `params` is handed down unawaited: awaiting it here would
// make the whole page one dynamic hole again. The breadcrumb is not data, so it
// sits above the boundary and comes out of the prerendered shell.
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	return (
		<div>
			<nav aria-label="Breadcrumb" className="pb-4">
				<Link
					href="/projects"
					className="font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:text-ink"
				>
					← Projects
				</Link>
			</nav>
			<Suspense fallback={<ProjectFallback />}>
				<ProjectBody params={params} />
			</Suspense>
		</div>
	);
}
