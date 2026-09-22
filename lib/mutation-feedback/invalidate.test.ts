import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
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
			expect(tags).toContain(CacheTag.todayDigest);
		});

		it("a note write busts notes and the Today chrome", () => {
			// The chrome carries the needs-review count (countNeedsReview), so a
			// note resolved in the app has to name todayDigest too.
			const { tags } = invalidationFor("notes.write");
			expect(tags).toContain(CacheTag.notes);
			expect(tags).toContain(CacheTag.todayDigest);
		});

		it("a link write busts links and the Today chrome", () => {
			// The chrome carries the unread-link count (unreadLinkCount).
			const { tags } = invalidationFor("links.write");
			expect(tags).toContain(CacheTag.links);
			expect(tags).toContain(CacheTag.todayDigest);
		});

		it("a notification write busts the Today chrome", () => {
			// The masthead badge reads unreadCount out of the cached chrome.
			expect(invalidationFor("notification.write").tags).toContain(CacheTag.todayDigest);
		});

		it("a capture busts tasks, notes, and the Today chrome", () => {
			// needsReview feeds the alerts row from the same cached chrome;
			// notes is live under "use cache", so capture must name it too.
			const { tags } = invalidationFor("capture.settled");
			expect(tags).toContain(CacheTag.tasks);
			expect(tags).toContain(CacheTag.notes);
			expect(tags).toContain(CacheTag.todayDigest);
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
