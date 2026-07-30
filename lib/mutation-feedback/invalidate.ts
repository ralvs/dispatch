import { revalidatePath } from "next/cache";

/**
 * Single seam for "what the UI should re-read after a write."
 * Action modules call afterMutation(kind) instead of listing paths.
 *
 * Prefer the narrowest path set that keeps visible surfaces honest.
 * Full cache tags (`day-schedule` / `today-chrome`) wait on Cache Components
 * (`"use cache"`); until then path revalidation is the real invalidator, and
 * client `staleTimes` + optimistic UI cover perceived lag.
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
	// Schedule bands + inbox/overdue counts on Today.
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
			// Alerts row unread-links count.
			revalidatePath("/today");
			return;
		case "notification.write":
			revalidatePath("/notifications");
			// Masthead unread badge on Today.
			revalidatePath("/today");
			return;
		case "settings.domain":
			revalidatePath("/settings");
			// Domain cadence ("In brief") + task domain chips.
			revalidatePath("/today");
			revalidatePath("/tasks");
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
			// Pin/autosave stay on /notes. Capture/review paths that change the
			// alerts-row needs-review count go through capture.settled or
			// today.only when they matter.
			revalidatePath("/notes");
			if (detail?.id) revalidatePath(`/notes/${detail.id}`);
			return;
		case "quotes.write":
			revalidatePath("/quotes");
			// Resurfaced / latest quote cards on Today.
			revalidatePath("/today");
			return;
		case "journal.write":
			// Journal is not surfaced on Today.
			revalidatePath("/journal");
			return;
		case "people.write":
			// People are not part of the Today briefing chrome.
			revalidatePath("/people");
			if (detail?.id) revalidatePath(`/people/${detail.id}`);
			return;
		case "projects.write":
			revalidatePath("/projects");
			// Active projects card on Today.
			revalidatePath("/today");
			return;
		case "projects.detail":
			revalidatePath("/projects");
			if (detail?.id) revalidatePath(`/projects/${detail.id}`);
			revalidatePath("/today");
			return;
	}
}
