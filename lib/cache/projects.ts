import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
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
	// `tasks` covers domains on task rows: settings.domain names it.
	cacheTag(CacheTag.projects, CacheTag.tasks);
	cacheLife("tagged");

	const sb = createAdminClient();
	const [projects, openTasks, taskCounts] = await Promise.all([
		listProjects(sb),
		listTasks(sb, { status: "open" }),
		countTasksByProject(sb),
	]);
	return { projects, openTasks, taskCounts };
}

/** One project, for /projects/[id]; null when there is none. */
export async function getCachedProject(id: string) {
	"use cache";
	cacheTag(CacheTag.projects, CacheTag.tasks);
	cacheLife("tagged");

	const sb = createAdminClient();
	const project = await getProject(sb, id);
	if (!project) return null;
	// Every project, for the task form's project picker.
	const [tasks, projects] = await Promise.all([listTasksForProject(sb, id), listProjects(sb)]);
	return { project, tasks, projects };
}

const reads: CachedReader["reads"] = [
	{ tag: CacheTag.projects, writes: ["projects.write", "projects.detail"] },
	{
		tag: CacheTag.tasks,
		writes: ["task.write", "task.assign", "capture.settled", "settings.domain"],
		external: ["capture", "sweep"],
	},
];

export const readers: CachedReader[] = [
	{ reader: "getCachedProjectBoard", reads },
	{ reader: "getCachedProject", reads },
];
