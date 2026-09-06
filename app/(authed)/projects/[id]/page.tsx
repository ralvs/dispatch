import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { getProject, listTasksForProject } from "@/lib/services/projects";
import { ProjectDetail } from "./project-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	const { sb } = await requireOwnerPage();
	const project = await getProject(sb, id);
	if (!project) notFound();

	const [tasks, domains] = await Promise.all([
		listTasksForProject(sb, id),
		listDomains(sb, { includeArchived: true }),
	]);

	return <ProjectDetail project={project} tasks={tasks} domains={domains} />;
}
