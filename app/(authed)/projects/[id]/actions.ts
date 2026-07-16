"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { CreateMilestoneSchema } from "@/lib/schemas/milestone";
import { UpdateProjectSchema } from "@/lib/schemas/project";
import {
	archiveProject,
	completeProject,
	createMilestone,
	deleteMilestone,
	toggleMilestone,
	updateProject,
} from "@/lib/services/projects";

function revalidateProjectViews(id: string) {
	revalidatePath("/projects");
	revalidatePath(`/projects/${id}`);
}

export async function updateProjectAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	const quotedHoursRaw = formData.get("quoted_hours");
	const parsed = UpdateProjectSchema.parse({
		name: formData.get("name") || undefined,
		description: formData.get("description") || null,
		domain_id: formData.get("domain_id") || null,
		type: formData.get("type") || null,
		quoted_hours:
			typeof quotedHoursRaw === "string" && quotedHoursRaw ? Number(quotedHoursRaw) : null,
		start_date: formData.get("start_date") || null,
		target_date: formData.get("target_date") || null,
		engagement_type: formData.get("engagement_type") || undefined,
		kind: formData.get("kind") || undefined,
	});
	await updateProject(sb, projectId, parsed);
	revalidateProjectViews(projectId);
}

export async function completeProjectAction(id: string) {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await completeProject(sb, projectId);
	revalidateProjectViews(projectId);
}

export async function archiveProjectAction(id: string) {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await archiveProject(sb, projectId);
	revalidateProjectViews(projectId);
}

export async function createMilestoneAction(projectId: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const id = z.uuid().parse(projectId);
	const weightRaw = formData.get("weight");
	const parsed = CreateMilestoneSchema.parse({
		title: formData.get("title"),
		weight: typeof weightRaw === "string" && weightRaw ? Number(weightRaw) : undefined,
	});
	await createMilestone(sb, id, parsed);
	revalidateProjectViews(id);
}

export async function toggleMilestoneAction(projectId: string, milestoneId: string, done: boolean) {
	const { sb } = await requireOwnerPage();
	await toggleMilestone(sb, z.uuid().parse(milestoneId), done);
	revalidateProjectViews(z.uuid().parse(projectId));
}

export async function deleteMilestoneAction(projectId: string, milestoneId: string) {
	const { sb } = await requireOwnerPage();
	await deleteMilestone(sb, z.uuid().parse(milestoneId));
	revalidateProjectViews(z.uuid().parse(projectId));
}
