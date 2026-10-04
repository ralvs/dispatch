import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ReaderDecl, Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { missingBusts, TABLE_WRITERS } from "@/lib/cache/writers";

/**
 * The guard from #9, reworked by docs/adr/0078: a cached reader names its tags
 * and the tables it reads, and every writer of those tables must bust one of
 * its tags. lib/cache/readers.int.test.ts checks the tables against the
 * queries the reader really runs.
 */

// Plain fs rather than import.meta.glob: Next and Vite both declare that, and
// their overloads collide under tsc.
const read = (file: string) => readFileSync(file, "utf8");
const cacheDir = import.meta.dirname;
const sources = Object.fromEntries(
	readdirSync(cacheDir)
		.filter((f) => f.endsWith(".ts") && !/\.test\.ts$/.test(f))
		.map((f) => [f, read(path.join(cacheDir, f))]),
);
const modules: Record<string, { readers?: Readers }> = Object.fromEntries(
	await Promise.all(
		Object.keys(sources).map(async (f) => [
			f,
			await import(/* @vite-ignore */ path.join(cacheDir, f)),
		]),
	),
);

// A file caches when a function body opens with the directive — not when a
// comment mentions it (reader.ts, tags.ts).
const cacheFiles = Object.entries(sources).filter(([, src]) => /^\s*"use cache";$/m.test(src));

/** The exported `"use cache"` functions of a file, each with its body. */
function cachedFunctions(src: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const chunk of src.split(/^export async function /m).slice(1)) {
		if (!/^\s*"use cache";$/m.test(chunk)) continue;
		found.set(chunk.slice(0, chunk.indexOf("(")), chunk);
	}
	return found;
}

const decls: [string, ReaderDecl][] = Object.values(modules).flatMap((m) =>
	Object.entries(m.readers ?? {}),
);

describe("cached readers declare their tags and tables", () => {
	it("finds the cached readers", () => {
		expect(cacheFiles.length).toBeGreaterThan(0);
	});

	it.each(cacheFiles)("%s declares exactly its cached functions", (file, src) => {
		const readers = modules[file]?.readers;
		expect(readers, `${file} caches without \`export const readers\``).toBeDefined();
		expect(Object.keys(readers ?? {}).sort(), file).toEqual(
			[...cachedFunctions(src).keys()].sort(),
		);
	});

	it.each(cacheFiles)("%s reads each function through its own declaration", (file, src) => {
		for (const [name, body] of cachedFunctions(src)) {
			const call = new RegExp(`\\b(cachedRead|cachedValue)\\(readers\\.${name},`);
			expect(body, `${file} ${name}`).toMatch(call);
		}
	});

	it("only reader.ts sets tags, cacheLife or a stamp in lib/cache", () => {
		for (const [file, src] of Object.entries(sources)) {
			if (file === "reader.ts") continue;
			expect(src, file).not.toMatch(/\b(cacheTag|cacheLife|nowUtc)\(/);
		}
	});

	it.each(decls)("%s declares at least one tag and one table", (_name, decl) => {
		expect(decl.tags.length).toBeGreaterThan(0);
		expect(decl.tables.length).toBeGreaterThan(0);
	});

	it.each(decls)("%s: every writer of a declared table busts one of its tags", (_name, decl) => {
		expect(missingBusts(decl)).toEqual([]);
	});

	it("flags a table whose writer busts none of the tags", () => {
		const misses = missingBusts({ tags: [CacheTag.tasks], tables: ["note_links"] });
		expect(misses).toContainEqual({ table: "note_links", writer: "notes.links" });
	});

	it("every table a service reads has an entry in TABLE_WRITERS", () => {
		const servicesDir = path.resolve(import.meta.dirname, "../services");
		const tables = new Set<string>();
		for (const f of readdirSync(servicesDir, { recursive: true, encoding: "utf8" })) {
			if (!f.endsWith(".ts")) continue;
			for (const m of read(path.join(servicesDir, f)).matchAll(/\.from\("(\w+)"\)/g)) {
				tables.add(m[1]);
			}
		}
		expect(tables.size).toBeGreaterThan(0);
		for (const t of tables) expect(Object.hasOwn(TABLE_WRITERS, t), t).toBe(true);
	});
});

describe("stampRead is the one stamp and a page only seeds", () => {
	it("no file outside lib/store/server.ts stamps a read or builds a snapshot literal", () => {
		const root = path.resolve(import.meta.dirname, "../..");
		const offenders = ["app", "lib"]
			.flatMap((dir) =>
				readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" }).map((f) =>
					path.join(dir, f),
				),
			)
			.filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
			.filter((f) => f !== path.join("lib", "store", "server.ts"))
			.filter((f) => {
				const src = read(path.join(root, f));
				return /readAt\s*[:=]\s*nowUtc\(/.test(src) || /:\s*Snapshot\s*=\s*\{/.test(src);
			});
		expect(offenders).toEqual([]);
	});
});
