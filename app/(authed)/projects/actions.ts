"use server";

import { type ActionResult, runFormAction } from "@/lib/action-result";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateProjectSchema } from "@/lib/schemas/project";
import { createProject } from "@/lib/services/projects";

function revalidateProjectViews() {
	afterMutation("projects.write");
}

export async function createProjectAction(formData: FormData): Promise<ActionResult> {
	const { sb } = await requireOwnerPage();
	return runFormAction(formData, async () => {
		await createProject(sb, decodeForm(CreateProjectSchema, formData));
		revalidateProjectViews();
	});
}
