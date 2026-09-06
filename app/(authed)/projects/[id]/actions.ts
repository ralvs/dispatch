"use server";

import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { UpdateProjectSchema } from "@/lib/schemas/project";
import { archiveProject, completeProject, updateProject } from "@/lib/services/projects";

function revalidateProjectViews(id: string) {
	afterMutation("projects.detail", { id });
}

export async function updateProjectAction(id: string, formData: FormData) {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateProjectSchema, formData);
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
