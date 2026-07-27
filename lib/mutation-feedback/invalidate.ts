import { revalidatePath } from "next/cache";

/**
 * Single seam for "what the UI should re-read after a write."
 * Action modules call afterMutation(kind) instead of listing paths.
 *
 * Path subsets today; cache tags land with the soft briefing split
 * (day-schedule vs chrome) without changing callers.
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

function taskViews() {
	revalidatePath("/tasks");
	revalidatePath("/inbox");
	// Day schedule + briefing chrome until tagged soft-split fully caches chrome.
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
			revalidatePath("/routines");
			revalidatePath("/today");
			return;
		case "links.write":
			revalidatePath("/links");
			revalidatePath("/today");
			return;
		case "notification.write":
			revalidatePath("/notifications");
			revalidatePath("/today");
			return;
		case "settings.domain":
			revalidatePath("/settings");
			revalidatePath("/today");
			return;
		case "settings.timezone":
			// Timezone genuinely reshapes every page (day boundaries, dates,
			// briefing) — the app-wide invalidation is warranted here.
			revalidatePath("/", "layout");
			return;
		case "theme":
			// Nothing to revalidate. Theme is a cookie plus `data-theme` on
			// <html>, which only the ROOT layout renders — so revalidating any
			// route below it repaints nothing, and revalidating app-wide would
			// discard every route's prefetch cache (undoing loading.tsx) for a
			// change that isn't a data change at all. ThemeToggle sets the
			// attribute directly; the cookie is only read on the next SSR.
			return;
		case "settings.reminders":
			revalidatePath("/settings");
			return;
		case "today.only":
			revalidatePath("/today");
			return;
		case "notes.write":
			revalidatePath("/notes");
			if (detail?.id) revalidatePath(`/notes/${detail.id}`);
			return;
		case "quotes.write":
			revalidatePath("/quotes");
			return;
		case "journal.write":
			revalidatePath("/journal");
			return;
		case "people.write":
			revalidatePath("/people");
			if (detail?.id) revalidatePath(`/people/${detail.id}`);
			return;
		case "projects.write":
			revalidatePath("/projects");
			return;
		case "projects.detail":
			revalidatePath("/projects");
			if (detail?.id) revalidatePath(`/projects/${detail.id}`);
			return;
	}
}
