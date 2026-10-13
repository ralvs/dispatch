// The project kind's create write (docs/adr/0077): the intent and its server
// call built from the same arguments. Beside this route's actions.ts; the
// detail page's writes live beside its own (projects/[id]/writes.ts), since a
// route never imports another route's folder (docs/adr/0070). Client-safe —
// server-action references only.

import { nowUtc } from "@/lib/dates";
import type { DomainRow } from "@/lib/schemas/domain";
import { type CreateProjectInput, createProjectForm, type ProjectRow } from "@/lib/schemas/project";
import { unshown } from "@/lib/store/kinds/record";
import { type Write, write } from "@/lib/store/write";
import { createProjectAction } from "./actions";

/** The project the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticProject(input: CreateProjectInput, domains: DomainRow[]): ProjectRow {
	const domain = domains.find((d) => d.id === input.domain_id);
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: input.name,
		description: input.description ?? null,
		domain_id: input.domain_id,
		status: "active",
		start_date: input.start_date ?? null,
		target_date: input.target_date ?? null,
		completed_at: null,
		color: input.color ?? null,
		created_at: at,
		updated_at: at,
		...(domain ? { domain: { id: domain.id, name: domain.name, color: domain.color } } : {}),
	};
}

export const projectWrites = {
	/** A form the decoder refuses shows nothing; the server's field errors do (docs/adr/0087). */
	create: (form: FormData, domains: DomainRow[]): Write<"project"> => {
		const input = createProjectForm.read(form);
		return write(
			"project",
			input ? { type: "create", row: optimisticProject(input, domains) } : unshown(),
			() => createProjectAction(form),
		);
	},
};
