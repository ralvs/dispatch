import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { TaskDomainOption, TaskProjectOption } from "@/components/task-fields";
import { requireOwnerPage } from "@/lib/auth";
import { readClock } from "@/lib/cache/settings";
import { getCachedTaskFormOptions } from "@/lib/cache/tasks";
import { getTask, type TaskRow } from "@/lib/services/tasks";

/**
 * Everything a task opened by its own URL needs (docs/adr/0079), for the two
 * routes that render it: the row itself, the form's option lists, and today.
 *
 * The row is read uncached, one query, like a note's body: it is the thing
 * being edited, so a stale copy would seed the form with an old title. The
 * option lists are cached. `task` is null for an id that is not a task.
 *
 * `cache`: the page and its generateMetadata both ask, and should pay once.
 */
export const readTaskToOpen = cache(async (rawId: string) => {
	const id = z.uuid().safeParse(rawId);
	// Security boundary first (iron rule #2): the options are a service-role read.
	const { sb } = await requireOwnerPage();
	if (!id.success) return null;
	const [task, options, clock] = await Promise.all([
		getTask(sb, id.data),
		getCachedTaskFormOptions(),
		readClock(),
	]);
	if (!task) return null;
	return { task, ...withOwnFiling(task, options), todayIso: clock.todayIso };
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
