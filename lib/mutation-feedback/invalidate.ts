import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTag, type CacheTagName } from "@/lib/cache/tags";

/**
 * Single seam for "what the UI should re-read after a write."
 * Action modules call afterMutation(kind) instead of listing paths.
 *
 * Dual invalidation (docs/adr/0033):
 * - revalidateTag — busts `"use cache"` data (chrome / schedule / settings)
 * - revalidatePath — busts the App Router RSC tree + client staleTimes payload
 */
export type MutationKind =
	| "task.write"
	| "task.assign"
	| "capture.settled"
	| "routine.write"
	| "links.write"
	| "notification.write"
	| "settings.domain"
	| "settings.timezone"
	| "settings.reminders"
	| "theme"
	| "today.only"
	| "notes.write"
	| "quotes.write"
	| "journal.write"
	| "people.write"
	| "projects.write"
	| "projects.detail";

function tag(...tags: CacheTagName[]) {
	// Next 16: second arg is a cacheLife profile for stale-while-revalidate.
	for (const t of tags) revalidateTag(t, "max");
}

function taskViews() {
	tag(CacheTag.daySchedule, CacheTag.tasks, CacheTag.todayChrome);
	revalidatePath("/tasks");
	revalidatePath("/inbox");
	revalidatePath("/today");
}

export function afterMutation(kind: MutationKind, detail?: { id?: string }): void {
	switch (kind) {
		case "task.write":
		case "task.assign":
		case "capture.settled":
			taskViews();
			return;
		case "routine.write":
			tag(CacheTag.routines, CacheTag.todayChrome);
			revalidatePath("/routines");
			revalidatePath("/today");
			return;
		case "links.write":
			tag(CacheTag.links, CacheTag.todayChrome);
			revalidatePath("/links");
			revalidatePath("/today");
			return;
		case "notification.write":
			tag(CacheTag.notifications, CacheTag.todayChrome);
			revalidatePath("/notifications");
			revalidatePath("/today");
			return;
		case "settings.domain":
			tag(CacheTag.settings, CacheTag.todayChrome, CacheTag.tasks);
			revalidatePath("/settings");
			revalidatePath("/today");
			revalidatePath("/tasks");
			return;
		case "settings.timezone":
			tag(
				CacheTag.settings,
				CacheTag.todayChrome,
				CacheTag.daySchedule,
				CacheTag.tasks,
				CacheTag.notes,
			);
			// Timezone genuinely reshapes every page (day boundaries, dates,
			// briefing) — the app-wide invalidation is warranted here.
			revalidatePath("/", "layout");
			return;
		case "theme":
			// Nothing to revalidate. Theme is a cookie plus `data-theme` on
			// <html> via the boot script — not a data cache entry.
			return;
		case "settings.reminders":
			tag(CacheTag.settings);
			revalidatePath("/settings");
			return;
		case "today.only":
			tag(CacheTag.todayChrome, CacheTag.daySchedule);
			revalidatePath("/today");
			return;
		case "notes.write":
			tag(CacheTag.notes);
			revalidatePath("/notes");
			if (detail?.id) revalidatePath(`/notes/${detail.id}`);
			return;
		case "quotes.write":
			tag(CacheTag.quotes, CacheTag.todayChrome);
			revalidatePath("/quotes");
			revalidatePath("/today");
			return;
		case "journal.write":
			tag(CacheTag.journal);
			revalidatePath("/journal");
			return;
		case "people.write":
			tag(CacheTag.people);
			revalidatePath("/people");
			if (detail?.id) revalidatePath(`/people/${detail.id}`);
			return;
		case "projects.write":
			tag(CacheTag.projects, CacheTag.todayChrome);
			revalidatePath("/projects");
			revalidatePath("/today");
			return;
		case "projects.detail":
			tag(CacheTag.projects, CacheTag.todayChrome);
			revalidatePath("/projects");
			if (detail?.id) revalidatePath(`/projects/${detail.id}`);
			revalidatePath("/today");
			return;
	}
}
