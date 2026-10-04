import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
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

	// Stamped inside the cache, before the reads, so the instant travels with
	// the data: a stale entry served after a write keeps its old stamp, and the
	// entity store's conflict rule replays the write over it (lib/store/types.ts).
	const readAt = nowUtc();
	const sb = createAdminClient();
	const tasks = await listInboxTasks(sb);
	const taskNoteIds = Object.fromEntries(
		await listNoteIdsForTargets(
			sb,
			"task",
			tasks.map((t) => t.id),
		),
	);
	return { readAt, tasks, taskNoteIds };
}

export const readers = {
	getCachedInbox: {
		tags: [CacheTag.tasks, CacheTag.notes, CacheTag.projects],
		tables: ["tasks", "projects", "stewardship_domains", "note_links"],
	},
} satisfies Readers;
