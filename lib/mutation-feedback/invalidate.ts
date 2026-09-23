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
 * re-renders DayView, and its prop-sync effect is what drops the
 * other days from the client day cache (lib/day-nav/revalidation.ts). Dropping
 * that path would leave a stale day on screen for up to REVALIDATE_AFTER_MS.
 *
 * ADR-0034 recorded a hope that wiring the unused tags to `"use cache"` reads
 * would let these `revalidatePath` calls become `revalidateTag` and stop wiping
 * the client cache on every write. It cannot — see docs/adr/0035. The same
 * `pathWasRevalidated` flag is read by action-handler.js:901 (unset => no fresh
 * RSC payload comes back) and by server-action-reducer.js:192-208 (set =>
 * invalidateBfCache(), globally). "Navigation stays cached across writes" and
 * "my own write lands" are one switch in opposite positions, so no tag wiring
 * buys the former. Tags are worth wiring for the server-side query saving
 * alone, which is why tasks / notes / links are now cached in lib/cache/.
 *
 * Every tag now has a live reader in lib/cache/. Each reader names the writes
 * that move its data (lib/cache/manifest.ts), and invalidate.test.ts fails when
 * one of those writes does not bust the reader's tag.
 */
/**
 * One path to revalidate. `layout` mirrors revalidatePath's second argument.
 */
export type MutationPath = { path: string; type?: "layout" };

/** What a mutation invalidates, as data. Pure — see invalidate.test.ts. */
export type Invalidation = { tags: CacheTagName[]; paths: MutationPath[] };

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

/**
 * The whole table, as data rather than as side effects — so route handlers can
 * take the tags without the paths, and so a test can assert on it without a
 * Next request scope. Nothing here calls into Next.
 */
export function invalidationFor(kind: MutationKind, detail?: { id?: string }): Invalidation {
	const p = (...paths: string[]): MutationPath[] => paths.map((path) => ({ path }));

	switch (kind) {
		case "task.write":
		case "task.assign":
			return {
				tags: [CacheTag.daySchedule, CacheTag.tasks, CacheTag.todayDigest],
				paths: p("/tasks", "/inbox", "/today"),
			};
		// Capture can land as task, note (incl. needs_review), event, quote, or
		// journal — own the full write surface so palette and external callers
		// cannot under-stack. The notification ledger stays a separate kind:
		// every caller that can write a row sends notification.write too. That
		// includes the palette, whose create_event records one in the executor.
		case "capture.settled":
			return {
				tags: [
					CacheTag.daySchedule,
					CacheTag.tasks,
					CacheTag.todayDigest,
					CacheTag.notes,
					CacheTag.quotes,
					CacheTag.journal,
				],
				paths: p("/tasks", "/inbox", "/today", "/notes", "/quotes", "/journal"),
			};
		case "routine.write":
			return {
				tags: [CacheTag.routines, CacheTag.todayDigest],
				paths: p("/routines", "/today"),
			};
		case "links.write":
			return { tags: [CacheTag.links, CacheTag.todayDigest], paths: p("/links", "/today") };
		case "notification.write":
			return {
				tags: [CacheTag.notifications, CacheTag.todayDigest],
				paths: p("/notifications", "/today"),
			};
		case "settings.domain":
			// Kind name kept for call-site stability; domains live on /domains now.
			return {
				tags: [CacheTag.settings, CacheTag.todayDigest, CacheTag.tasks, CacheTag.domains],
				paths: p("/domains", "/today", "/tasks", "/projects"),
			};
		case "settings.timezone":
			return {
				tags: [
					CacheTag.settings,
					CacheTag.todayDigest,
					CacheTag.daySchedule,
					CacheTag.tasks,
					CacheTag.notes,
				],
				// Timezone genuinely reshapes every page (day boundaries, dates,
				// the Today digest) — the app-wide invalidation is warranted here.
				paths: [{ path: "/", type: "layout" }],
			};
		case "theme":
			// Nothing to revalidate. Theme is a cookie plus `data-theme` on
			// <html> via the boot script — not a data cache entry.
			return { tags: [], paths: [] };
		case "settings.reminders":
			return { tags: [CacheTag.settings], paths: p("/settings") };
		case "today.only":
			return { tags: [CacheTag.todayDigest, CacheTag.daySchedule], paths: p("/today") };
		case "notes.write":
			// todayDigest because loadTodayDigest counts needs_review notes
			// (lib/services/today.ts). The cron path was already covered — the
			// sweep sends capture.settled, which carries todayDigest — but a note
			// resolved or created in the app is the same write and must say so,
			// or Today's needs-review counter sits on a stale count for a whole
			// cacheLife window.
			return {
				tags: [CacheTag.notes, CacheTag.todayDigest],
				paths: detail?.id ? p("/notes", `/notes/${detail.id}`) : p("/notes"),
			};
		case "quotes.write":
			return { tags: [CacheTag.quotes, CacheTag.todayDigest], paths: p("/quotes", "/today") };
		case "journal.write":
			return { tags: [CacheTag.journal], paths: p("/journal") };
		case "people.write":
			return {
				tags: [CacheTag.people],
				paths: detail?.id ? p("/people", `/people/${detail.id}`) : p("/people"),
			};
		case "projects.write":
			return { tags: [CacheTag.projects, CacheTag.todayDigest], paths: p("/projects", "/today") };
		case "projects.detail":
			return {
				tags: [CacheTag.projects, CacheTag.todayDigest],
				paths: detail?.id
					? p("/projects", `/projects/${detail.id}`, "/today")
					: p("/projects", "/today"),
			};
	}
}

function bustTags(tags: readonly CacheTagName[]): void {
	// Next 16: second arg is a cacheLife profile for stale-while-revalidate.
	for (const t of tags) revalidateTag(t, "max");
}

/**
 * From a Server Action. Tags AND paths — the paths are what return a fresh RSC
 * payload to the client, which every `useOptimistic` site depends on to settle
 * into (see the header note above before trimming any of them).
 */
export function afterMutation(kind: MutationKind, detail?: { id?: string }): void {
	const { tags, paths } = invalidationFor(kind, detail);
	bustTags(tags);
	for (const { path, type } of paths) {
		if (type) revalidatePath(path, type);
		else revalidatePath(path);
	}
}

/**
 * Every write that reaches the database from outside a browser session — the
 * crons, the capture webhook, the calendar bridge — and the kinds it moves.
 * Route handlers spread one of these into afterExternalMutation rather than
 * listing kinds inline, so a cached reader can name the external writers of
 * its data (lib/cache/manifest.ts) and a test can check both sides agree.
 *
 * Iron rule #6: an autonomous action writes a notifications row, so a writer
 * that can record one carries "notification.write".
 */
export const EXTERNAL_WRITES = {
	/** /api/capture with a bare URL: a link, plus its ledger row. */
	captureLink: ["links.write", "notification.write"],
	/** /api/capture: a task, note, event, quote or journal entry, plus its ledger row. */
	capture: ["capture.settled", "notification.write"],
	/** cron/sweep: re-parses needs_review notes. */
	sweep: ["capture.settled", "notification.write"],
	cronObservations: ["notification.write"],
	/** cron/reminders: each delivered reminder is a ledger row. */
	cronReminders: ["notification.write"],
	/** cron/caldav: calendar events only; silent by design. */
	cronCaldav: ["today.only"],
	/** /api/calendar/bridge on success: calendar events only; quiet by design. */
	calendarBridge: ["today.only"],
	/** /api/calendar/bridge on failure: the ledger row that reports it. */
	calendarBridgeFailure: ["notification.write"],
} as const satisfies Record<string, readonly MutationKind[]>;

export type ExternalWriter = keyof typeof EXTERNAL_WRITES;

/**
 * From a Route Handler — the crons and the external capture surface.
 *
 * Tags only, deliberately. These routes are invoked by cron-job.org and the
 * iOS Shortcut, not by a browser running the app: there is no client router
 * cache on the other end for `revalidatePath` to evict, and no `useOptimistic`
 * transition waiting on a fresh RSC payload. Calling it would cost a page
 * render nobody reads. `revalidateTag` is the half that actually matters here —
 * it discards the `"use cache"` entries the next real page load would read.
 *
 * Variadic because one external write often spans domains: a capture writes a
 * task or note AND a notification row (iron rule #6), and the ledger row is
 * what the Today masthead badge counts.
 */
export function afterExternalMutation(...kinds: readonly MutationKind[]): void {
	const tags = new Set<CacheTagName>();
	for (const kind of kinds) for (const t of invalidationFor(kind).tags) tags.add(t);
	bustTags([...tags]);
}
