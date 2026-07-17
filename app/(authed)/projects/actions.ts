"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerPage } from "@/lib/auth";
import { decodeForm } from "@/lib/form-decode";
import { CreateProjectSchema } from "@/lib/schemas/project";
import { createProject } from "@/lib/services/projects";

function revalidateProjectViews() {
	revalidatePath("/projects");
}

export async function createProjectAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const parsed = decodeForm(CreateProjectSchema, formData, {
		spec: { quoted_hours: "number" },
	});
	await createProject(sb, parsed);
	revalidateProjectViews();
}
