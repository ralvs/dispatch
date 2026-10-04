import type { CacheTagName } from "@/lib/cache/tags";
import type { Table } from "@/lib/cache/writers";

/**
 * What a cached reader promises, next to its `"use cache"` function
 * (docs/adr/0062 Decision 2, #9, docs/adr/0078).
 *
 * The `tagged` cacheLife profile expires after seven days. Tags, not the clock,
 * keep an entry honest, so a reader whose tag no write busts is wrong for up to
 * a week. The rule: **before adding a cached reader, name every table it
 * reads.** This type is where you name them.
 *
 * - `tags` are the tags the reader caches under.
 * - `tables` lists every table it reads, embedded selects included.
 *
 * The writers of each table come from TABLE_WRITERS (lib/cache/writers.ts).
 * `lib/cache/readers.test.ts` fails when one of them busts none of the tags;
 * `lib/cache/readers.int.test.ts` fails when the reader touches a table it
 * does not declare, or declares one it does not touch.
 */
export type ReaderDecl = {
	readonly tags: readonly CacheTagName[];
	readonly tables: readonly Table[];
};

/** A cache file's `readers`: one declaration per exported `"use cache"` function. */
export type Readers = Readonly<Record<string, ReaderDecl>>;
