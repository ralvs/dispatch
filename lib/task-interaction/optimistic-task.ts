// Client-side stand-ins for a task the server has not written yet. The entity
// store shows one while the create is in flight and swaps in the server's row
// when it confirms (lib/store, #26). Client-safe: no server imports.
import type { TaskRow } from "@/lib/schemas/task";

type DomainOption = { id: string; name: string; color?: string | null };
type ProjectOption = { id: string; name: string };

/** A new task as the client can know it: unfiled, no server round-trip. */
function optimisticTask(overrides: Partial<TaskRow> = {}): TaskRow {
	return {
		id: crypto.randomUUID(),
		title: "Untitled",
		notes: null,
		status: "open",
		due_date: null,
		due_time: null,
		priority: 3,
		project_id: null,
		domain_id: null,
		recurrence_rule: null,
		recurrence_day: null,
		top3_for_date: null,
		source: "manual",
		created_at: new Date().toISOString(),
		completed_at: null,
		domain: null,
		project: null,
		...overrides,
	};
}

/**
 * Raw text plus the domain the form stated; everything else defaults and the
 * parsed row swaps in when the store confirms the write. The domain is carried rather than left
 * null because the list is filtered BY domain — a fake row filed nowhere would
 * vanish from the view that created it and reappear a moment later.
 */
export function optimisticTaskFromText(
	text: string,
	domainId: string,
	domains: readonly DomainOption[],
): TaskRow {
	const domain = domains.find((d) => d.id === domainId);
	return optimisticTask({
		title: text,
		domain_id: domainId || null,
		domain: domain ? { id: domain.id, name: domain.name, color: domain.color ?? null } : null,
	});
}

export function optimisticTaskFromForm(
	formData: FormData,
	domains: readonly DomainOption[],
	projects: readonly ProjectOption[],
): TaskRow {
	const domainId = String(formData.get("domain_id") ?? "") || null;
	const domain = domains.find((d) => d.id === domainId);
	const projectId = String(formData.get("project_id") ?? "") || null;
	const project = projects.find((p) => p.id === projectId);
	const priorityRaw = Number(formData.get("priority"));

	return optimisticTask({
		title: String(formData.get("title") ?? "").trim() || "Untitled",
		notes: String(formData.get("notes") ?? "") || null,
		due_date: String(formData.get("due_date") ?? "") || null,
		due_time: String(formData.get("due_time") ?? "") || null,
		priority: Number.isFinite(priorityRaw) ? priorityRaw : 3,
		domain_id: domainId,
		// The optimistic builder hard-coded `project_id: null` while the form
		// could not set one. It can now (shape plan §06), so the fake row has
		// to carry the real answer or the project filter drops it on sight.
		project_id: projectId,
		recurrence_rule: String(formData.get("recurrence_rule") ?? "") || null,
		domain: domain ? { id: domain.id, name: domain.name, color: domain.color ?? null } : null,
		project: project ? { id: project.id, name: project.name } : null,
	});
}
