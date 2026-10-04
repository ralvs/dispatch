import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ReaderDecl, Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
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

	// `readAt` is the entity store's version (lib/store/types.ts), stamped
	// inside the cache so a stale entry keeps its old stamp.
	const readAt = nowUtc();
	const sb = createAdminClient();
	const [projects, openTasks, taskCounts] = await Promise.all([
		listProjects(sb),
		listTasks(sb, { status: "open" }),
		countTasksByProject(sb),
	]);
	return { readAt, projects, openTasks, taskCounts };
}

/** One project, for /projects/[id]; null when there is none. */
export async function getCachedProject(id: string) {
	"use cache";
	cacheTag(CacheTag.projects, CacheTag.tasks);
	cacheLife("tagged");

	// Stamped inside the cache, before the reads, so the instant travels with
	// the data: a stale entry served after a write keeps its old stamp, and the
	// entity store's conflict rule replays the write over it (lib/store/types.ts).
	const readAt = nowUtc();
	const sb = createAdminClient();
	const project = await getProject(sb, id);
	if (!project) return null;
	// Every project, for the task form's project picker.
	const [tasks, projects] = await Promise.all([listTasksForProject(sb, id), listProjects(sb)]);
	return { readAt, project, tasks, projects };
}

// `tasks` covers the domains embedded in project and task rows: settings.domain names it.
const decl = {
	tags: [CacheTag.projects, CacheTag.tasks],
	tables: ["projects", "tasks", "stewardship_domains"],
} satisfies ReaderDecl;

export const readers = { getCachedProjectBoard: decl, getCachedProject: decl } satisfies Readers;
