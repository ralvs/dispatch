"use server";

import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateProjectSchema, type ProjectRow } from "@/lib/schemas/project";
import { createProject } from "@/lib/services/projects";
import { stampWrite } from "@/lib/store/server";
import type { StoreWrite } from "@/lib/store/types";

/** Returns the project it wrote, with its domain, for the entity store to confirm from (#30). */
export async function createProjectAction(
	formData: FormData,
): Promise<ActionResult<StoreWrite<ProjectRow>>> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		const project = await createProject(sb, decodeForm(CreateProjectSchema, formData));
		afterMutation("projects.write");
		return stampWrite([project]);
	});
}
