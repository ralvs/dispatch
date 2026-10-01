"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { type ProjectRow, UpdateProjectSchema } from "@/lib/schemas/project";
import {
	archiveProject,
	completeProject,
	getProject,
	updateProject,
} from "@/lib/services/projects";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

// Every action returns the project as it stands after the write (#30), so the
// project page and /projects confirm from it instead of waiting on a page
// render. Failures throw; the store runner rolls back on a throw.

type ProjectWrite = StoreWrite<ProjectRow>;

function revalidateProjectViews(id: string) {
	afterMutation("projects.detail", { id });
}

/** A project that is gone comes back as a deleted id. */
async function writtenProject(sb: SupabaseClient, id: string): Promise<ProjectWrite> {
	const row = await getProject(sb, id);
	return row ? stampWrite([row]) : stampWrite([], [id]);
}

export async function updateProjectAction(
	id: string,
	formData: FormData,
): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	const parsed = decodeForm(UpdateProjectSchema, formData);
	await updateProject(sb, projectId, parsed);
	revalidateProjectViews(projectId);
	return { ok: true, data: await writtenProject(sb, projectId) };
}

export async function completeProjectAction(id: string): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await completeProject(sb, projectId);
	revalidateProjectViews(projectId);
	return { ok: true, data: await writtenProject(sb, projectId) };
}

export async function archiveProjectAction(id: string): Promise<ActionResult<ProjectWrite>> {
	const { sb } = await requireOwnerPage();
	const projectId = z.uuid().parse(id);
	await archiveProject(sb, projectId);
	revalidateProjectViews(projectId);
	return { ok: true, data: await writtenProject(sb, projectId) };
}
