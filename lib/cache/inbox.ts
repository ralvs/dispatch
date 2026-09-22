import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { listInboxTasks } from "@/lib/services/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /inbox (docs/adr/0035): unfiled tasks and their
 * linked notes. The list leaves out quiet tasks, and quiet depends on a
 * project's status — so a project write moves it too.
 */
export async function getCachedInbox() {
	"use cache";
	cacheTag(CacheTag.tasks, CacheTag.notes, CacheTag.projects);
	cacheLife("tagged");

	const sb = createAdminClient();
	const tasks = await listInboxTasks(sb);
	const taskNoteIds = Object.fromEntries(
		await listNoteIdsForTargets(
			sb,
			"task",
			tasks.map((t) => t.id),
		),
	);
	return { tasks, taskNoteIds };
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedInbox",
		reads: [
			{
				tag: CacheTag.tasks,
				writes: ["task.write", "task.assign", "capture.settled"],
				external: ["capture", "sweep"],
			},
			{
				tag: CacheTag.notes,
				writes: ["notes.write", "capture.settled"],
				external: ["capture", "sweep"],
			},
			{ tag: CacheTag.projects, writes: ["projects.write", "projects.detail"] },
		],
	},
];
