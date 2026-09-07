import type { ProjectRow } from "@/lib/services/projects";

// Shared option lists + label lookups for the project forms and views, plus
// the status grouping used on the index page. One place so the create form,
// the edit form, and the read-only detail/row views can't drift out of sync
// on what an enum value means.

// PROJECT_TYPES / KINDS are gone with the columns behind them: `type` and
// `kind` were display-only badges, and the project's domain already says what
// they were reaching for. ENGAGEMENT_TYPES went earlier, for the agency reason
// (docs/adr/0056).

export const STATUS_GROUPS: { status: ProjectRow["status"]; label: string }[] = [
	{ status: "active", label: "Active" },
	// Paused is the stored value; "Quiet" is what it means now — an undated
	// task in one of these projects is held back from Today and /tasks.
	{ status: "paused", label: "Quiet" },
	{ status: "done", label: "Done" },
	{ status: "archived", label: "Archived" },
];

export function statusLabel(status: string): string {
	return STATUS_GROUPS.find((g) => g.status === status)?.label ?? status;
}
