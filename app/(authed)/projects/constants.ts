import type { ProjectRow } from "@/lib/services/projects";

// Shared option lists + label lookups for the project forms and views, plus
// the status grouping used on the index page. One place so the create form,
// the edit form, and the read-only detail/row views can't drift out of sync
// on what an enum value means.

export const PROJECT_TYPES = [
	{ value: "", label: "Unspecified" },
	{ value: "client", label: "Client" },
	{ value: "internal", label: "Internal" },
	{ value: "content", label: "Content" },
];

export const KINDS = [
	{ value: "project", label: "Project" },
	{ value: "area", label: "Area" },
];

export const ENGAGEMENT_TYPES = [
	{ value: "project", label: "Project" },
	{ value: "retainer", label: "Retainer" },
];

export const STATUS_GROUPS: { status: ProjectRow["status"]; label: string }[] = [
	{ status: "active", label: "Active" },
	{ status: "paused", label: "Paused" },
	{ status: "done", label: "Done" },
	{ status: "archived", label: "Archived" },
];

function labelFor(options: { value: string; label: string }[], value: string): string {
	return options.find((o) => o.value === value)?.label ?? value;
}

export function projectTypeLabel(value: string): string {
	return labelFor(PROJECT_TYPES, value);
}

export function kindLabel(value: string): string {
	return labelFor(KINDS, value);
}

export function engagementTypeLabel(value: string): string {
	return labelFor(ENGAGEMENT_TYPES, value);
}

export function statusLabel(status: string): string {
	return STATUS_GROUPS.find((g) => g.status === status)?.label ?? status;
}
