import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { todayInTz } from "@/lib/dates";
import { listDomains } from "@/lib/services/domains";
import { getProject, listProjects, listTasksForProject } from "@/lib/services/projects";
import { getAppTimezone } from "@/lib/services/settings";
import { AddTaskButton } from "../add-task-button";
import { ProjectDetail } from "./project-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	const { sb } = await requireOwnerPage();
	const project = await getProject(sb, id);
	if (!project) notFound();

	const [tasks, domains, projects, tz] = await Promise.all([
		listTasksForProject(sb, id),
		listDomains(sb, { includeArchived: true }),
		listProjects(sb),
		getAppTimezone(sb),
	]);

	return (
		<ProjectDetail
			project={project}
			tasks={tasks}
			domains={domains}
			addTask={
				<AddTaskButton
					project={{ id: project.id, name: project.name }}
					projects={projects.map((p) => ({ id: p.id, name: p.name }))}
					domains={domains
						.filter((d) => d.active)
						.map((d) => ({ id: d.id, name: d.name, color: d.color }))}
					todayIso={todayInTz(tz)}
				/>
			}
		/>
	);
}
