"use server";

import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { afterMutation } from "@/lib/mutation-feedback/invalidate";
import { CreateProjectSchema } from "@/lib/schemas/project";
import { createProject } from "@/lib/services/projects";

function revalidateProjectViews() {
	afterMutation("projects.write");
}

export async function createProjectAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateProjectSchema, formData, {
		spec: { quoted_hours: "number" },
	});
	await createProject(sb, parsed);
	revalidateProjectViews();
}
