// Client-side stand-ins for a task the server has not written yet. The entity
// store shows one while the create is in flight and swaps in the server's row
// when it confirms (lib/store, #26). Client-safe: no server imports.
import { DEFAULT_TASK_PRIORITY, type TaskFormFields, type TaskRow } from "@/lib/schemas/task";

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
		priority: DEFAULT_TASK_PRIORITY,
		project_id: null,
		domain_id: null,
		recurrence_rule: null,
		recurrence_day: null,
		series_id: null,
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

/** The task form's decoded columns, joined to the domain and project the form picked. */
export function optimisticTaskFromFields(
	fields: TaskFormFields,
	domains: readonly DomainOption[],
	projects: readonly ProjectOption[],
): TaskRow {
	const domain = domains.find((d) => d.id === fields.domain_id);
	const project = projects.find((p) => p.id === fields.project_id);
	return optimisticTask({
		...fields,
		domain: domain ? { id: domain.id, name: domain.name, color: domain.color ?? null } : null,
		project: project ? { id: project.id, name: project.name } : null,
	});
}
