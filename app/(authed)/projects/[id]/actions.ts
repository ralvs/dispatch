"use server";

import { z } from "zod";
import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { afterMutation } from "@/lib/invalidate";
import { type ProjectRow, updateProjectForm } from "@/lib/schemas/project";
import { archiveProject, completeProject, updateProject } from "@/lib/services/projects";
import { written } from "@/lib/services/written";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the project as it stands after the write (#30), so the
// project page and /projects confirm from it instead of waiting on a page
// render. A refused form field comes back as a field error; other failures
// throw, and the store runner rolls back on a throw.

type ProjectWrite = StoreWrite<ProjectRow>;

function revalidateProjectViews() {
	afterMutation("projects.detail");
}

export async function updateProjectAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	// A refused field comes back as a field error, not a throw (docs/adr/0087).
	return runFormAction(formData, async () => {
		const projectId = z.uuid().parse(id);
		await updateProject(sb, projectId, updateProjectForm.parse(formData));
		revalidateProjectViews();
		return written(sb, "project", projectId);
	});
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
