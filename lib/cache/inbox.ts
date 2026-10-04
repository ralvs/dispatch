import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
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
	return cachedRead(readers.getCachedInbox, async () => {
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
	});
}

export const readers = {
	getCachedInbox: {
		tags: [CacheTag.tasks, CacheTag.notes, CacheTag.projects],
		tables: ["tasks", "projects", "stewardship_domains", "note_links"],
	},
} satisfies Readers;
