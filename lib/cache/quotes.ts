import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { listQuotes } from "@/lib/services/quotes";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /quotes (docs/adr/0035). Quotes arrive from the app and from capture. */
export async function getCachedQuotes() {
	"use cache";
	cacheTag(CacheTag.quotes);
	cacheLife("tagged");

	// `readAt` is the entity store's version (lib/store/types.ts), stamped
	// inside the cache so a stale entry keeps its old stamp.
	const readAt = nowUtc();
	const quotes = await listQuotes(createAdminClient());
	return { readAt, quotes };
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedQuotes",
		reads: [
			{
				tag: CacheTag.quotes,
				writes: ["quotes.write", "capture.settled", "capture.event"],
				external: ["capture", "sweep"],
			},
		],
	},
];
