import "server-only";
import { cachedRead, type ReaderDecl, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import {
	countTasksByProject,
	getProject,
	listProjects,
	listTasksForProject,
} from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /projects (docs/adr/0035): every project, the open
 * tasks for the inline lists, and task counts per project.
 */
export async function getCachedProjectBoard() {
	"use cache";
	return cachedRead(readers.getCachedProjectBoard, async () => {
		const sb = createAdminClient();
		const [projects, openTasks, taskCounts] = await Promise.all([
			listProjects(sb),
			listTasks(sb, { status: "open" }),
			countTasksByProject(sb),
		]);
		return { projects, openTasks, taskCounts };
	});
}

/** One project, for /projects/[id]; null when there is none. */
export async function getCachedProject(id: string) {
	"use cache";
	return cachedRead(readers.getCachedProject, async () => {
		const sb = createAdminClient();
		const project = await getProject(sb, id);
		if (!project) return null;
		// Every project, for the task form's project picker.
		const [tasks, projects] = await Promise.all([listTasksForProject(sb, id), listProjects(sb)]);
		return { project, tasks, projects };
	});
}

// `tasks` covers the domains embedded in project and task rows: settings.domain names it.
const decl = {
	tags: [CacheTag.projects, CacheTag.tasks],
	tables: ["projects", "tasks", "stewardship_domains"],
} satisfies ReaderDecl;

export const readers = { getCachedProjectBoard: decl, getCachedProject: decl } satisfies Readers;
