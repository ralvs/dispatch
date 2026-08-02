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
 * Nothing time-dependent lives in here. `todayIso` decides overdue styling and
 * is derived per request from the timezone, so it stays outside — a cached
 * entry surviving midnight would otherwise paint yesterday's overdue set.
 */
export async function getCachedTaskBoard() {
	"use cache";
	// Every tag whose data this read touches. `tasks` covers domains too:
	// settings.domain names it (see invalidationFor), because a renamed domain
	// changes how every task row reads.
	cacheTag(CacheTag.tasks, CacheTag.notes, CacheTag.people, CacheTag.projects);
	cacheLife({ stale: 60, revalidate: 300, expire: 900 });

	const sb = createAdminClient();
	const [openTasks, doneTasks, domains, projects, people] = await Promise.all([
		listTasks(sb, { status: "open" }),
		// Only the "Recently done" band consumes these — there is no Done filter
		// to page through, so ten is the whole appetite.
		listRecentDone(sb, 10),
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
