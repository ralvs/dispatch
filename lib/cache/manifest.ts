import type { CacheTagName } from "@/lib/cache/tags";
import type { ExternalWriter, MutationKind } from "@/lib/mutation-feedback/invalidate";

/**
 * What a cached reader promises, next to its `cacheTag(...)` call (docs/adr/0062
 * Decision 2, and #9).
 *
 * The `tagged` cacheLife profile expires after seven days. Tags, not the clock,
 * keep an entry honest, so a reader whose tag no write busts is wrong for up to
 * a week. The rule: **before adding a cached reader, name every write that
 * moves its data.** This type is where you name them.
 *
 * - `reader` is the exported `"use cache"` function.
 * - `reads` has one entry per tag the reader caches under, and must match its
 *   `cacheTag(...)` call exactly.
 * - `writes` lists every in-app mutation kind that changes the data behind
 *   that tag. `external` lists every cron or `/api/*` writer that does
 *   (EXTERNAL_WRITES in lib/mutation-feedback/invalidate.ts).
 *
 * `lib/mutation-feedback/invalidate.test.ts` fails when a declared write does
 * not bust the tag, and when a file in lib/cache/ caches without declaring.
 */
export type CachedReader = {
	reader: string;
	reads: {
		tag: CacheTagName;
		writes: readonly MutationKind[];
		external?: readonly ExternalWriter[];
	}[];
};
