"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerPage } from "@/lib/auth";
import { CreateProjectSchema } from "@/lib/schemas/project";
import { createProject } from "@/lib/services/projects";

function revalidateProjectViews() {
	revalidatePath("/projects");
}

export async function createProjectAction(formData: FormData) {
	const { sb } = await requireOwnerPage();
	const quotedHoursRaw = formData.get("quoted_hours");
	const parsed = CreateProjectSchema.parse({
		name: formData.get("name"),
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
	await createProject(sb, parsed);
	revalidateProjectViews();
}
