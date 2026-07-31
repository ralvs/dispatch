import { revalidatePath, revalidateTag } from "next/cache";
import { CacheTag, type CacheTagName } from "@/lib/cache/tags";

/**
 * Single seam for "what the UI should re-read after a write."
 * Action modules call afterMutation(kind) instead of listing paths.
 *
 * Dual invalidation (docs/adr/0033):
 * - revalidateTag — busts `"use cache"` data (chrome / schedule / settings)
 * - revalidatePath — busts the App Router RSC tree + client staleTimes payload
 *
 * A constraint worth internalizing before trimming any `revalidatePath` call
 * below (verified against Next 16.2.10 source, not derived):
 *
 * - Any `revalidatePath` call evicts the ENTIRE client-side router cache
 *   (BFCache), for every route, not just the path passed in. The chain:
 *   server-action-reducer.js:192-208 calls invalidateBfCache() whenever a
 *   server action revalidates anything -> bfcache.js:52-56 bumps a
 *   module-level `currentBfCacheVersion` -> cache-map.js:131-133
 *   `isValueExpired` then treats every entry stamped below that version as
 *   expired, globally. There's a literal `TODO: Evict only segments with
 *   matching tags and/or paths` in the Next source at that last spot — this
 *   is known upstream behavior, not a bug to route around.
 * - `revalidateTag(t, "max")` does NOT evict the client cache.
 *   revalidate.js:207-212 only flips `pathWasRevalidated` when there's no
 *   cache-life profile or `cacheLife.expire === 0`; the built-in `max`
 *   profile used by `tag()` below has `expire: 31536000`
 *   (config-shared.js:167-171), so it never trips that flag.
 * - Consequence: the client-cache cost of `revalidatePath` is BINARY PER
 *   ACTION, not per path. Calling it once vs. calling it on three paths
 *   produces the identical global wipe — trimming paths off an action that
 *   already calls it elsewhere buys nothing on the client, only a marginal
 *   server-side saving.
 * - Dropping `revalidatePath` entirely is not free either. When nothing is
 *   revalidated, `skipPageRendering` in action-handler.js (~874, ~901) is
 *   true and the action returns no fresh RSC payload. Every `useOptimistic`
 *   site in this app reverts to its pre-mutation props once the transition
 *   settles with no fresh data to settle into — the user's own write visibly
 *   undoing itself. Never remove the last `revalidatePath` off an action that
 *   feeds a `useOptimistic` consumer without confirming a fresh RSC still
 *   lands some other way.
 * - This binary-not-per-path behavior is also what makes a long
 *   `staleTimes.dynamic` worth configuring at all: a bigger window only pays
 *   off between mutations, since any mutation wipes it anyway.
 *
 * One concrete dependent: `revalidatePath("/today")` in taskViews() is what
 * re-renders DayScheduleSection, and its prop-sync effect is what drops the
 * other days from the client day cache (lib/day-nav/revalidation.ts). Dropping
 * that path would leave a stale day on screen for up to REVALIDATE_AFTER_MS.
 *
 * The 9 tags below that no cached function consumes — tasks, notes, links,
 * notifications, routines, quotes, journal, people, projects — are no-ops
 * today (only today-chrome / day-schedule / settings are wired to a
 * `"use cache"` read). Wiring them is the unlock: it's what would let some of
 * these `revalidatePath` calls become `revalidateTag` and stop wiping the
 * client cache on every write.
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
