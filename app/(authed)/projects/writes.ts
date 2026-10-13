// The project kind's create write (docs/adr/0077): the intent and its server
// call built from the same arguments. Beside this route's actions.ts; the
// detail page's writes live beside its own (projects/[id]/writes.ts), since a
// route never imports another route's folder (docs/adr/0070). Client-safe —
// server-action references only.

import { nowUtc } from "@/lib/dates";
import type { DomainRow } from "@/lib/schemas/domain";
import type { ProjectRow } from "@/lib/schemas/project";
import { type Write, write } from "@/lib/store/write";
import { createProjectAction } from "./actions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The project the list shows while the server writes it; the server's row replaces it (#30). */
function optimisticProject(formData: FormData, domains: DomainRow[]): ProjectRow {
	const text = (key: string) => {
		const value = String(formData.get(key) ?? "").trim();
		return value === "" ? null : value;
	};
	const date = (key: string) => {
		const value = text(key);
		return value && DATE.test(value) ? value : null;
	};
	const domain = domains.find((d) => d.id === text("domain_id"));
	const at = nowUtc();
	return {
		id: crypto.randomUUID(),
		name: text("name") ?? "",
		description: text("description"),
		domain_id: domain?.id ?? "",
		status: "active",
		start_date: date("start_date"),
		target_date: date("target_date"),
		completed_at: null,
		color: null,
		created_at: at,
		updated_at: at,
		...(domain ? { domain: { id: domain.id, name: domain.name, color: domain.color } } : {}),
	};
}

export const projectWrites = {
	create: (form: FormData, domains: DomainRow[]): Write<"project"> =>
		write("project", { type: "create", row: optimisticProject(form, domains) }, () =>
			createProjectAction(form),
		),
};
