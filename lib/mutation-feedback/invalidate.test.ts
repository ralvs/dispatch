import { describe, expect, it } from "vitest";
import { CacheTag } from "@/lib/cache/tags";
import { invalidationFor, type MutationKind } from "./invalidate";

/**
 * `invalidationFor` is the pure half of the seam — afterMutation and
 * afterExternalMutation both read it, so asserting here covers the external
 * route handlers too without needing a Next request scope.
 */

const ALL_KINDS: MutationKind[] = [
	"task.write",
	"task.assign",
	"capture.settled",
	"routine.write",
	"links.write",
	"notification.write",
	"settings.domain",
	"settings.timezone",
	"settings.reminders",
	"theme",
	"today.only",
	"notes.write",
	"quotes.write",
	"journal.write",
	"people.write",
	"projects.write",
	"projects.detail",
];

/** Tags with a live `"use cache"` reader. A write that changes data feeding one
 * of these and fails to name it is a staleness bug — the whole point of §A. */
const LIVE_TAGS = [
	CacheTag.todayChrome,
	CacheTag.settings,
	CacheTag.tasks,
	CacheTag.notes,
	CacheTag.links,
];

describe("invalidationFor", () => {
	it("returns an entry for every kind", () => {
		for (const kind of ALL_KINDS) {
			expect(invalidationFor(kind), kind).toBeDefined();
		}
	});

	it("names only known tags", () => {
		const known = new Set<string>(Object.values(CacheTag));
		for (const kind of ALL_KINDS) {
			for (const tag of invalidationFor(kind).tags) {
				expect(known.has(tag), `${kind} -> ${tag}`).toBe(true);
			}
		}
	});

	it("theme touches nothing — it is a cookie, not a cache entry", () => {
		expect(invalidationFor("theme")).toEqual({ tags: [], paths: [] });
	});

	it("every kind except theme returns at least one path", () => {
		for (const kind of ALL_KINDS.filter((k) => k !== "theme")) {
			expect(invalidationFor(kind).paths.length, kind).toBeGreaterThan(0);
		}
	});

	// The trap documented in the invalidate.ts header: dropping the last path
	// off an action means no fresh RSC payload, and every useOptimistic site
	// reverts the user's own write on screen.
	it("keeps a path on the kinds that feed useOptimistic consumers", () => {
		for (const kind of [
			"task.write",
			"task.assign",
			"notes.write",
			"notification.write",
			"routine.write",
		] as MutationKind[]) {
			expect(invalidationFor(kind).paths.length, kind).toBeGreaterThan(0);
		}
	});

	describe("live tags are named by the writes that move their data", () => {
		it("a task write busts tasks and the Today chrome", () => {
			const { tags } = invalidationFor("task.write");
			expect(tags).toContain(CacheTag.tasks);
			expect(tags).toContain(CacheTag.todayChrome);
		});

		it("a note write busts notes", () => {
			expect(invalidationFor("notes.write").tags).toContain(CacheTag.notes);
		});

		it("a link write busts links and the Today chrome", () => {
			// The chrome carries the unread-link count (unreadLinkCount).
			const { tags } = invalidationFor("links.write");
			expect(tags).toContain(CacheTag.links);
			expect(tags).toContain(CacheTag.todayChrome);
		});

		it("a notification write busts the Today chrome", () => {
			// The masthead badge reads unreadCount out of the cached chrome.
			expect(invalidationFor("notification.write").tags).toContain(CacheTag.todayChrome);
		});

		it("a capture busts tasks and the Today chrome", () => {
			// needsReview feeds the alerts row from the same cached chrome.
			const { tags } = invalidationFor("capture.settled");
			expect(tags).toContain(CacheTag.tasks);
			expect(tags).toContain(CacheTag.todayChrome);
		});

		it("a timezone change busts every live tag", () => {
			const { tags } = invalidationFor("settings.timezone");
			for (const live of LIVE_TAGS) {
				if (live === CacheTag.links) continue; // links render no date-derived text
				expect(tags, live).toContain(live);
			}
		});
	});

	describe("detail?.id", () => {
		it("adds the detail path for notes when given an id", () => {
			expect(invalidationFor("notes.write", { id: "abc" }).paths).toContainEqual({
				path: "/notes/abc",
			});
		});

		it("omits it when there is no id", () => {
			const paths = invalidationFor("notes.write").paths.map((p) => p.path);
			expect(paths).toEqual(["/notes"]);
		});

		it("keeps /today on projects.detail with an id", () => {
			const paths = invalidationFor("projects.detail", { id: "p1" }).paths.map((p) => p.path);
			expect(paths).toEqual(["/projects", "/projects/p1", "/today"]);
		});
	});

	it("only settings.timezone revalidates a layout", () => {
		for (const kind of ALL_KINDS) {
			const layouts = invalidationFor(kind).paths.filter((p) => p.type === "layout");
			expect(layouts.length, kind).toBe(kind === "settings.timezone" ? 1 : 0);
		}
	});
});
