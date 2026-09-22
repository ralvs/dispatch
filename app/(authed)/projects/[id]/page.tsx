import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProject } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { AddTaskButton } from "../add-task-button";
import { ProjectDetail } from "./project-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
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
