import { revalidateTag, updateTag } from "next/cache";
import { CacheTag, type CacheTagName } from "@/lib/cache/tags";

/**
 * Single seam for "what the UI should re-read after a write."
 * Action modules call afterMutation(kind) instead of listing tags.
 *
 * Writes update rows, not pages (#24, docs/adr/0069). A write busts the
 * `"use cache"` entries that hold its data and nothing else: the browser
 * already holds the truth for the rows it wrote, in the client entity store
 * (lib/store), which the action's returned rows confirm.
 *
 * What each server-side call does, verified against the installed Next
 * 16.3.5 source (node_modules/next/dist/server/web/spec-extension/
 * revalidate.js:54-84,219-223, and client/components/router-reducer/
 * reducers/server-action-reducer.js:218-235):
 *
 * | Called from a server action | Revalidation kind | What the client does |
 * |---|---|---|
 * | `revalidateTag(tag, "max")` | none | Re-renders nothing, wipes nothing. The server entry turns stale-while-revalidate: the next read of that tag serves the pre-write entry once. |
 * | `updateTag(tag)` | StaticAndDynamic | Re-renders the page from the root, wipes the BFCache and the whole prefetch cache. Read-your-writes. |
 * | `revalidatePath(path)` | StaticAndDynamic | Same as `updateTag`. |
 * | `refresh()` | DynamicOnly | Re-renders the page and wipes the BFCache. |
 *
 * The reducer carries Next's own TODO: "Evict only segments with matching
 * tags and/or paths." Until that lands, every read-your-writes API wipes the
 * whole client cache, so this module uses one only where it must:
 *
 * - Store-backed kinds bust their tags with `revalidateTag(tag, "max")`. The
 *   stale-once read is covered by the store's conflict rule
 *   (lib/store/types.ts): a seed read before a confirmed write never
 *   overwrites it.
 * - `readYourWrites` kinds use `updateTag`: the settings knobs, a palette
 *   capture (it writes rows the client never applied), and a note's link rail
 *   (`note_links`, which the store does not hold). They are rare, so the cache
 *   wipe is acceptable there.
 */

/** What a mutation invalidates, as data. Pure — see invalidate.test.ts. */
export type Invalidation = { tags: CacheTagName[]; readYourWrites: boolean };

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
	| "notes.links"
	| "quotes.write"
	| "journal.write"
	| "people.write"
	| "projects.write"
	| "projects.detail";

/** Kinds whose writer needs its own write on the next render (see the header). */
const READ_YOUR_WRITES: ReadonlySet<MutationKind> = new Set([
	"capture.settled",
	"settings.timezone",
	"settings.reminders",
	"notes.links",
]);

/**
 * The whole table, as data rather than as side effects — so route handlers can
 * take the tags alone, and so a test can assert on it without a Next request
 * scope. Nothing here calls into Next.
 */
export function invalidationFor(kind: MutationKind): Invalidation {
	return { tags: tagsFor(kind), readYourWrites: READ_YOUR_WRITES.has(kind) };
}

function tagsFor(kind: MutationKind): CacheTagName[] {
	switch (kind) {
		case "task.write":
		case "task.assign":
			return [CacheTag.daySchedule, CacheTag.tasks, CacheTag.todayDigest];
		case "capture.settled":
			return [
				CacheTag.daySchedule,
				CacheTag.tasks,
				CacheTag.todayDigest,
				CacheTag.notes,
				CacheTag.quotes,
				CacheTag.journal,
			];
		case "routine.write":
			return [CacheTag.routines, CacheTag.todayDigest];
		case "links.write":
			return [CacheTag.links, CacheTag.todayDigest];
		case "notification.write":
			return [CacheTag.notifications, CacheTag.todayDigest];
		case "settings.domain":
			return [CacheTag.settings, CacheTag.todayDigest, CacheTag.tasks, CacheTag.domains];
		case "settings.timezone":
			return [
				CacheTag.settings,
				CacheTag.todayDigest,
				CacheTag.daySchedule,
				CacheTag.tasks,
				CacheTag.notes,
			];
		case "theme":
			return [];
		case "settings.reminders":
			return [CacheTag.settings];
		case "today.only":
			return [CacheTag.todayDigest, CacheTag.daySchedule];
		case "notes.write":
		case "notes.links":
			return [CacheTag.notes, CacheTag.todayDigest];
		case "quotes.write":
			return [CacheTag.quotes, CacheTag.todayDigest];
		case "journal.write":
			return [CacheTag.journal];
		case "people.write":
			return [CacheTag.people];
		case "projects.write":
		case "projects.detail":
			return [CacheTag.projects, CacheTag.todayDigest];
	}
}

function bustTags(tags: readonly CacheTagName[]): void {
	// Next 16: second arg is a cacheLife profile for stale-while-revalidate.
	for (const t of tags) revalidateTag(t, "max");
}

/**
 * From a Server Action. Tags only, so the action's response carries no page
 * render and the client keeps its router cache; a `readYourWrites` kind
 * expires its tags instead, which re-renders the page (see the header).
 */
export function afterMutation(kind: MutationKind): void {
	const { tags, readYourWrites } = invalidationFor(kind);
	if (readYourWrites) for (const t of tags) updateTag(t);
	else bustTags(tags);
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
 * Tags only, and never `updateTag`, which Next allows only in a Server
 * Action. These routes are invoked by cron-job.org and the iOS Shortcut, not
 * by a browser running the app: there is no page on the other end to
 * re-render. `revalidateTag` discards the `"use cache"` entries the next real
 * page load would read; an open tab learns of the write through its own
 * refresh pull (components/soft-refresh.tsx).
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
