import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import { listDomains } from "@/lib/services/domains";
import { listMentionsForSources } from "@/lib/services/mentions";
import { listNoteIdsForTargets } from "@/lib/services/note-links";
import { listMentionCandidates } from "@/lib/services/people";
import { listProjects } from "@/lib/services/projects";
import { listRecentDone, listTasks } from "@/lib/services/tasks";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /tasks (docs/adr/0035).
 *
 * Service-role client for the same reason lib/cache/today.ts uses one:
 * `"use cache"` cannot close over a cookie-bound RLS client. Call only after
 * requireOwnerPage() — single-user app, admin reads the rows the owner would.
 *
 * `sinceUtc` is the one time-dependent input: it is the cache key for the
 * Recently done window (today and the two local days before it). Overdue
 * styling still stays outside — `todayIso` is derived per request so a
 * cached entry surviving midnight cannot paint yesterday's overdue set.
 */
export async function getCachedTaskBoard(sinceUtc: string) {
	"use cache";
	// Every tag whose data this read touches. `tasks` covers domains too:
	// settings.domain names it (see invalidationFor), because a renamed domain
	// changes how every task row reads.
	cacheTag(CacheTag.tasks, CacheTag.notes, CacheTag.people, CacheTag.projects);
	cacheLife("tagged");

	const sb = createAdminClient();
	const [openTasks, doneTasks, domains, projects, people] = await Promise.all([
		listTasks(sb, { status: "open" }),
		// The Open view's glance-strip is the only consumer — no Done filter
		// to page through. The window is last-3-local-days, not a row cap.
		listRecentDone(sb, sinceUtc),
		listDomains(sb),
		listProjects(sb),
		listMentionCandidates(sb),
	]);

	const allTaskIds = [...openTasks, ...doneTasks].map((t) => t.id);
	const [taskNoteIds, taskMentions] = await Promise.all([
		listNoteIdsForTargets(sb, "task", allTaskIds).then((rows) => Object.fromEntries(rows)),
		listMentionsForSources(sb, "task", allTaskIds).then((map) =>
			Object.fromEntries(
				[...map.entries()].map(([id, persons]) => [
					id,
					persons.map((p) => ({ id: p.id, name: p.name })),
				]),
			),
		),
	]);

	return { openTasks, doneTasks, domains, projects, people, taskNoteIds, taskMentions };
}
