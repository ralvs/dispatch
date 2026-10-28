// The project detail page's writes (docs/adr/0077): each builder makes the
// intent and its server call from the same arguments. Beside this route's
// actions.ts (docs/adr/0070). Client-safe — server-action references only.

import { nowUtc } from "@/lib/dates";
import type { DomainRow } from "@/lib/schemas/domain";
import { type ProjectRow, type UpdateProjectInput, updateProjectForm } from "@/lib/schemas/project";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import { archiveProjectAction, completeProjectAction, updateProjectAction } from "./actions";

const UPDATE_ERROR = "Couldn't update project.";
const SAVE_ERROR = "Couldn't save project.";

/** What an edit asks for, so the page shows it while the server writes it. */
function projectPatch(input: UpdateProjectInput, domains: DomainRow[]): Partial<ProjectRow> {
	const domain = domains.find((d) => d.id === input.domain_id);
	return {
		...input,
		...(domain ? { domain: { id: domain.id, name: domain.name, color: domain.color } } : {}),
	};
}

export const projectDetailWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	update: (id: string, form: FormData, domains: DomainRow[]): Write<"project"> => {
		const input = updateProjectForm.read(form);
		return write(
			"project",
			input ? { type: "patch", id, patch: projectPatch(input, domains) } : unshown(id),
			() => updateProjectAction(id, form),
			SAVE_ERROR,
		);
	},
	complete: (id: string): Write<"project"> =>
		write(
			"project",
			{ type: "patch", id, patch: { status: "done", completed_at: nowUtc() } },
			() => completeProjectAction(id),
			UPDATE_ERROR,
			"Project completed",
		),
	archive: (id: string): Write<"project"> =>
		write(
			"project",
			{ type: "patch", id, patch: { status: "archived" } },
			() => archiveProjectAction(id),
			UPDATE_ERROR,
			"Project archived",
		),
};
