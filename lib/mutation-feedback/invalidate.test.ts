import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CachedReader } from "@/lib/cache/manifest";
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
			"capture.settled",
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
const cacheDir = path.resolve(import.meta.dirname, "../cache");
const sources = Object.fromEntries(
	readdirSync(cacheDir)
		.filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
		.map((f) => [f, read(path.join(cacheDir, f))]),
);
const apiDir = path.resolve(import.meta.dirname, "../../app/api");
const routeSources = Object.fromEntries(
	readdirSync(apiDir, { recursive: true, encoding: "utf8" })
		.filter((f) => f.endsWith("route.ts"))
		.map((f) => [f, read(path.join(apiDir, f))]),
);
const modules: Record<string, { readers?: CachedReader[] }> = Object.fromEntries(
	await Promise.all(
		Object.keys(sources).map(async (f) => [f, await import(`../cache/${f.slice(0, -3)}.ts`)]),
	),
);

/**
 * The guard from #9: a cached reader cannot ship without naming the writes that
 * move its data, and every named write must bust its tag. Kept apart from the
 * useOptimistic path guard above — #31 inverts that one and must not touch this.
 */
describe("cached readers name the writes that move their data", () => {
	const tagKey = new Map<string, string>(Object.entries(CacheTag).map(([k, v]) => [v, k]));
	// A file caches when a function body opens with the directive — not when a
	// comment mentions it (manifest.ts, tags.ts).
	const cacheFiles = Object.entries(sources).filter(([, src]) => /^\s*"use cache";$/m.test(src));

	/** The exported `"use cache"` functions of a file, with the tags each one caches under. */
	function cachedFunctions(src: string): Map<string, Set<string>> {
		const found = new Map<string, Set<string>>();
		for (const chunk of src.split(/^export async function /m).slice(1)) {
			if (!/^\s*"use cache";$/m.test(chunk)) continue;
			const name = chunk.slice(0, chunk.indexOf("("));
			const tags = new Set<string>();
			for (const call of chunk.matchAll(/cacheTag\(([^)]*)\)/g)) {
				for (const m of call[1].matchAll(/CacheTag\.(\w+)/g)) tags.add(m[1]);
			}
			found.set(name, tags);
		}
		return found;
	}

	it("finds the cached readers", () => {
		expect(cacheFiles.length).toBeGreaterThan(0);
	});

	it.each(cacheFiles)(
		"%s declares every cached function and every tag it caches under",
		(path, src) => {
			const readers = modules[path]?.readers;
			expect(readers, `${path} caches without \`export const readers\``).toBeDefined();
			const declared = new Map(
				(readers ?? []).map((r) => [
					r.reader,
					new Set(r.reads.map((read) => tagKey.get(read.tag))),
				]),
			);
			const actual = cachedFunctions(src);
			expect([...declared.keys()].sort(), path).toEqual([...actual.keys()].sort());
			for (const [name, tags] of actual) {
				expect([...(declared.get(name) ?? [])].sort(), `${path} ${name}`).toEqual([...tags].sort());
			}
		},
	);

	const reads = Object.values(modules).flatMap((m) =>
		(m.readers ?? []).flatMap((r) => r.reads.map((read) => ({ reader: r.reader, ...read }))),
	);

	it.each(reads)("$reader: every declared write busts $tag", ({ tag, writes, external }) => {
		expect(writes.length).toBeGreaterThan(0);
		for (const kind of writes) {
			expect(invalidationFor(kind).tags, kind).toContain(tag);
		}
		for (const writer of external ?? []) {
			const tags = EXTERNAL_WRITES[writer].flatMap((kind) => invalidationFor(kind).tags);
			expect(tags, writer).toContain(tag);
		}
	});

	it("routes spread a declared external writer into afterExternalMutation", () => {
		for (const [path, src] of Object.entries(routeSources)) {
			for (const call of src.matchAll(/afterExternalMutation\(([^)]*)\)/g)) {
				expect(call[1], path).toMatch(/^\.\.\.EXTERNAL_WRITES\.\w+$/);
			}
		}
	});

	it("every module that records a notification is one whose write paths were checked", () => {
		// recordNotification is also reached from inside services, where no route
		// scan can see it. The callers are pinned; a new one fails here until its
		// write paths are shown to bust notification.write:
		// - capture/executor.ts: reached by /api/capture and cron/sweep (both
		//   declare notification.write) and by the palette's captureText (below).
		// - reminders.ts: reached by cron/reminders only.
		const root = path.resolve(import.meta.dirname, "../..");
		const callers = ["app", "lib"]
			.flatMap((dir) =>
				readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" }).map((f) =>
					path.join(dir, f),
				),
			)
			.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.startsWith("app/api/"))
			.filter((f) => read(path.join(root, f)).includes("recordNotification("))
			.filter((f) => f !== "lib/services/notifications.ts")
			.sort();
		expect(callers).toEqual(["lib/services/capture/executor.ts", "lib/services/reminders.ts"]);
	});

	it("a server action that runs capture busts notification.write", () => {
		const authed = path.resolve(import.meta.dirname, "../../app/(authed)");
		const callers = readdirSync(authed, { recursive: true, encoding: "utf8" })
			.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
			.map((f) => [f, read(path.join(authed, f))] as const)
			.filter(([, src]) => src.includes("await capture("));
		expect(callers.length).toBeGreaterThan(0);
		for (const [file, src] of callers) {
			expect(src, file).toContain('afterMutation("notification.write")');
		}
	});

	it("a route that records a notification busts the notification tags (iron rule #6)", () => {
		const writesNotifications = new Set<string>(
			(Object.keys(EXTERNAL_WRITES) as ExternalWriter[]).filter((w) =>
				(EXTERNAL_WRITES[w] as readonly MutationKind[]).includes("notification.write"),
			),
		);
		for (const [path, src] of Object.entries(routeSources)) {
			if (!src.includes("recordNotification(")) continue;
			const used = [...src.matchAll(/EXTERNAL_WRITES\.(\w+)/g)].map((m) => m[1]);
			expect(
				used.some((w) => writesNotifications.has(w)),
				`${path} records a notification but busts no notification tag`,
			).toBe(true);
		}
	});
});
