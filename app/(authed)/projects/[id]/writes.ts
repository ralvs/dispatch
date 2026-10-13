// The project detail page's writes (docs/adr/0077): each builder makes the
// intent and its server call from the same arguments. Beside this route's
// actions.ts (docs/adr/0070). Client-safe — server-action references only.

import { nowUtc } from "@/lib/dates";
import type { DomainRow } from "@/lib/schemas/domain";
import { type ProjectRow, ProjectStatusSchema } from "@/lib/schemas/project";
import { type Write, write } from "@/lib/store/write";
import { archiveProjectAction, completeProjectAction, updateProjectAction } from "./actions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UPDATE_ERROR = "Couldn't update project.";
const SAVE_ERROR = "Couldn't save project.";

/** What an edit asks for, so the page shows it while the server writes it. */
function projectPatch(formData: FormData, domains: DomainRow[]): Partial<ProjectRow> {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const date = (key: string) => {
		const value = text(key);
		return value && DATE.test(value) ? value : null;
	};
	const name = text("name");
	const domain = domains.find((d) => d.id === text("domain_id"));
	const status = ProjectStatusSchema.safeParse(formData.get("status"));
	return {
		...(name ? { name } : {}),
		description: text("description"),
		start_date: date("start_date"),
		target_date: date("target_date"),
		...(domain
			? {
					domain_id: domain.id,
					domain: { id: domain.id, name: domain.name, color: domain.color },
				}
			: {}),
		...(status.success ? { status: status.data } : {}),
	};
}

export const projectDetailWrites = {
	update: (id: string, form: FormData, domains: DomainRow[]): Write<"project"> =>
		write(
			"project",
			{ type: "patch", id, patch: projectPatch(form, domains) },
			() => updateProjectAction(id, form),
			SAVE_ERROR,
		),
	complete: (id: string): Write<"project"> =>
		write(
			"project",
			{ type: "patch", id, patch: { status: "done", completed_at: nowUtc() } },
			() => completeProjectAction(id),
			UPDATE_ERROR,
		),
	archive: (id: string): Write<"project"> =>
		write(
			"project",
			{ type: "patch", id, patch: { status: "archived" } },
			() => archiveProjectAction(id),
			UPDATE_ERROR,
		),
};
