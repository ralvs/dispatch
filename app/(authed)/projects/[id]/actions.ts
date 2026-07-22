"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
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
	afterMutation("projects.detail", { id });
}

export async function updateProjectAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateProjectSchema, formData, {
		spec: { quoted_hours: "number" },
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
	const parsed = decodeForm(CreateMilestoneSchema, formData, { spec: { weight: "number" } });
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
