import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { getProject, listMilestones } from "@/lib/services/projects";
import { ProjectDetail } from "./project-detail";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	const { sb } = await requireOwnerPage();
	const project = await getProject(sb, id);
	if (!project) notFound();

	const [milestones, domains] = await Promise.all([
		listMilestones(sb, id),
		listDomains(sb, { includeArchived: true }),
	]);

	return <ProjectDetail project={project} milestones={milestones} domains={domains} />;
}
