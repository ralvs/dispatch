import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CacheTag, type CacheTagName } from "@/lib/cache/tags";
import {
	EXTERNAL_WRITES,
	type ExternalWriter,
	invalidationFor,
	type MutationKind,
} from "./invalidate";

/**
 * `invalidationFor` is the pure half of the seam — afterMutation and
 * afterExternalMutation both read it, so asserting here covers the external
 * route handlers too without needing a Next request scope.
 */

const ALL_KINDS: MutationKind[] = [
	"task.write",
	"task.assign",
	"capture.settled",
	"capture.event",
	"routine.write",
	"links.write",
	"notification.write",
	"settings.domain",
	"settings.timezone",
	"settings.reminders",
	"theme",
	"today.only",
	"notes.write",
	"notes.links",
	"quotes.write",
	"journal.write",
	"people.write",
	"projects.write",
	"projects.detail",
];

/** Tags with a live `"use cache"` reader. A write that changes data feeding one
 * of these and fails to name it is a staleness bug — the whole point of §A. */
const LIVE_TAGS = [
	CacheTag.todayDigest,
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
		expect(invalidationFor("theme")).toEqual({ tags: [], readYourWrites: false });
	});

	// #31 inverted the old guard: store-backed kinds re-render nothing. Their
	// lists read the entity store, which the action's returned rows confirm, so
	// a page render would only wipe the client router cache.
	it("store-backed kinds bust tags only, with no page render", () => {
		for (const kind of [
			"task.write",
			"task.assign",
			"notes.write",
			"notification.write",
			"routine.write",
			"links.write",
			"quotes.write",
			"journal.write",
			"people.write",
			"projects.write",
			"projects.detail",
			"settings.domain",
			"today.only",
		] as MutationKind[]) {
			expect(invalidationFor(kind).readYourWrites, kind).toBe(false);
		}
	});

	it("only the rare writes the store cannot confirm read their own writes", () => {
		const rare = ALL_KINDS.filter((k) => invalidationFor(k).readYourWrites).sort();
		expect(rare).toEqual([
			"capture.event",
			"notes.links",
			"settings.reminders",
			"settings.timezone",
		]);
	});

	describe("live tags are named by the writes that move their data", () => {
		it.each<[string, MutationKind, CacheTagName[]]>([
			[
				"a task write busts tasks and the Today chrome",
				"task.write",
				[CacheTag.tasks, CacheTag.todayDigest],
			],
			// The chrome carries the needs-review count (countNeedsReview), so a
			// note resolved in the app has to name todayDigest too.
			[
				"a note write busts notes and the Today chrome",
				"notes.write",
				[CacheTag.notes, CacheTag.todayDigest],
			],
			// The chrome carries the unread-link count (unreadLinkCount).
			[
				"a link write busts links and the Today chrome",
				"links.write",
				[CacheTag.links, CacheTag.todayDigest],
			],
			// The masthead badge reads unreadCount out of the cached chrome.
			["a notification write busts the Today chrome", "notification.write", [CacheTag.todayDigest]],
			// needsReview feeds the alerts row from the same cached chrome; notes
			// is live under "use cache", so capture must name it too.
			[
				"a capture busts tasks, notes, and the Today chrome",
				"capture.settled",
				[CacheTag.tasks, CacheTag.notes, CacheTag.todayDigest],
			],
		])("%s", (_name, kind, expected) => {
			const { tags } = invalidationFor(kind);
			for (const tag of expected) expect(tags).toContain(tag);
		});

		it("a timezone change busts every live tag", () => {
			const { tags } = invalidationFor("settings.timezone");
			for (const live of LIVE_TAGS) {
				if (live === CacheTag.links) continue; // links render no date-derived text
				expect(tags, live).toContain(live);
			}
		});
	});
});

// Plain fs rather than import.meta.glob: Next and Vite both declare that, and
// their overloads collide under tsc.
const read = (file: string) => readFileSync(file, "utf8");
const apiDir = path.resolve(import.meta.dirname, "../app/api");
const routeSources = Object.fromEntries(
	readdirSync(apiDir, { recursive: true, encoding: "utf8" })
		.filter((f) => f.endsWith("route.ts"))
		.map((f) => [f, read(path.join(apiDir, f))]),
);
/**
 * External writers: every route that writes declares itself in EXTERNAL_WRITES,
 * and every notification it records busts the notification tags. The cached
 * readers' own guard lives in lib/cache/readers.test.ts.
 */
describe("external writers name the writes that move their data", () => {
	it("routes spread a declared external writer into afterExternalMutation", () => {
		for (const [path, src] of Object.entries(routeSources)) {
			for (const call of src.matchAll(/afterExternalMutation\(([^)]*)\)/g)) {
				expect(call[1], path).toMatch(/^\.\.\.EXTERNAL_WRITES\.\w+$/);
			}
		}
	});

	it("only the ledger writer carries notification.write", () => {
		const carriers = (Object.keys(EXTERNAL_WRITES) as ExternalWriter[]).filter((w) =>
			(EXTERNAL_WRITES[w] as readonly MutationKind[]).includes("notification.write"),
		);
		expect(carriers).toEqual(["ledger"]);
	});

	it("no service but the ledger reaches next/cache (ADR-0075)", () => {
		// ADR-0001 keeps services free of Next; the ledger busts its own tags.
		const root = path.resolve(import.meta.dirname, "services");
		const offenders = readdirSync(root, { recursive: true, encoding: "utf8" })
			.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
			.filter((f) => f !== "notifications.ts")
			.filter((f) => /from "(next\/cache|@\/lib\/invalidate)"/.test(read(path.join(root, f))))
			.sort();
		expect(offenders).toEqual([]);
	});
});
