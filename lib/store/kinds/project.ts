// The project kind (#30). /projects lists every project by name (listProjects)
// and groups them by status; a project's page reads a scoped list of one. The
// project's tasks are task rows (kinds/task.ts), not part of this row.

import type { ProjectRow } from "@/lib/schemas/project";
import { type RecordIntent, recordKind, recordListView } from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type ProjectIntent = RecordIntent<ProjectRow>;

/** A view of one project — its page's header — admits no other. */
export type ProjectScope = { id: string };

export const projectKind: KindAdapter<"project"> = recordKind<ProjectRow>();

export const projectListView: ViewAdapter<"projectList"> = {
	kind: "project",
	...recordListView<ProjectRow, ProjectScope>({
		belongs: (row, scope) => scope === undefined || row.id === scope.id,
		compare: (a, b) => a.name.localeCompare(b.name),
	}),
};
