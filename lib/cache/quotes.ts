import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { listQuotes } from "@/lib/services/quotes";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /quotes (docs/adr/0035). Quotes arrive from the app and from capture. */
export async function getCachedQuotes() {
	"use cache";
	cacheTag(CacheTag.quotes);
	cacheLife("tagged");

	return listQuotes(createAdminClient());
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedQuotes",
		reads: [
			{
				tag: CacheTag.quotes,
				writes: ["quotes.write", "capture.settled"],
				external: ["capture", "sweep"],
			},
		],
	},
];
