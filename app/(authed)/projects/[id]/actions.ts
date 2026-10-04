"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/invalidate";
import { type ProjectRow, UpdateProjectSchema } from "@/lib/schemas/project";
import { archiveProject, completeProject, updateProject } from "@/lib/services/projects";
import { written } from "@/lib/services/written";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the project as it stands after the write (#30), so the
// project page and /projects confirm from it instead of waiting on a page
// render. Failures throw; the store runner rolls back on a throw.

type ProjectWrite = StoreWrite<ProjectRow>;

function revalidateProjectViews() {
	afterMutation("projects.detail");
}

export async function updateProjectAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateProjectSchema, formData);
	await updateProject(sb, projectId, parsed);
	revalidateProjectViews();
	return { ok: true, data: await written(sb, "project", projectId) };
}

export async function completeProjectAction(id: string): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await completeProject(sb, projectId);
	revalidateProjectViews();
	return { ok: true, data: await written(sb, "project", projectId) };
}

export async function archiveProjectAction(id: string): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await archiveProject(sb, projectId);
	revalidateProjectViews();
	return { ok: true, data: await written(sb, "project", projectId) };
}
