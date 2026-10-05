import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { TaskDomainOption, TaskProjectOption } from "@/components/task-fields";
import { requireOwnerPage } from "@/lib/auth";
import { readClock } from "@/lib/cache/settings";
import { getCachedTaskFormOptions } from "@/lib/cache/tasks";
import { getTask, type TaskRow } from "@/lib/services/tasks";
import { viewKey } from "@/lib/store/keys";
import { seedOf, stampRead } from "@/lib/store/server";

/**
 * Everything a task opened by its own URL needs (docs/adr/0079), for the two
 * routes that render it: the row itself, the form's option lists, and today.
 *
 * The row is read uncached, one query, like a note's body: it is the thing
 * being edited, so a stale copy would seed the form with an old title. The
 * option lists are cached. Null for an id that is not a task.
 *
 * The row also goes out as `snapshot`, a list of one in the entity store
 * (docs/adr/0069), and the form reads it from there. The router keeps this
 * render for a while and replays it when you open the task again, so the
 * row in it can be older than an edit made since in this tab. Stamped with
 * its read, it loses to that edit, and the form shows what you saved.
 *
 * `cache`: the page and its generateMetadata both ask, and should pay once.
 */
export const readTaskToOpen = cache(async (rawId: string) => {
	const id = z.uuid().safeParse(rawId);
	// Security boundary first (iron rule #2): the options are a service-role read.
	const { sb } = await requireOwnerPage();
	if (!id.success) return null;
	const [read, options, clock] = await Promise.all([
		stampRead(() => getTask(sb, id.data)),
		getCachedTaskFormOptions(),
		readClock(),
	]);
	const task = read.data;
	if (!task) return null;
	const snapshot = seedOf(read, clock, {
		views: [{ key: viewKey.task(task.id), type: "taskList", data: { rows: [task] } }],
	});
	return { task, snapshot, ...withOwnFiling(task, options), todayIso: clock.todayIso };
});

type FormOptions = Awaited<ReturnType<typeof getCachedTaskFormOptions>>;

/**
 * The option lists, sure to hold the task's own domain and project. The lists
 * are cached and the row is not, so a project made where no app write busts
 * the cache (a direct insert, another device mid-revalidate) can be missing.
 * A select with no option for the stored value submits nothing, and Save
 * would quietly unfile the task. The row carries both names, so add them.
 */
function withOwnFiling(
	task: TaskRow,
	options: FormOptions,
): { domains: TaskDomainOption[]; projects: TaskProjectOption[]; people: FormOptions["people"] } {
	const { domain, project, domain_id: domainId } = task;
	const domains: TaskDomainOption[] =
		domain && !options.domains.some((d) => d.id === domain.id)
			? [...options.domains, domain]
			: options.domains;
	const projects: TaskProjectOption[] =
		// A task's domain is its project's domain (docs/adr/0072).
		project && domainId && !options.projects.some((p) => p.id === project.id)
			? [...options.projects, { ...project, domain_id: domainId }]
			: options.projects;
	return { domains, projects, people: options.people };
}
