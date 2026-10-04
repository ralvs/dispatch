import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listQuotes } from "@/lib/services/quotes";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /quotes (docs/adr/0035). Quotes arrive from the app and from capture. */
export async function getCachedQuotes() {
	"use cache";
	return cachedRead(readers.getCachedQuotes, async () => ({
		quotes: await listQuotes(createAdminClient()),
	}));
}

export const readers = {
	getCachedQuotes: { tags: [CacheTag.quotes], tables: ["quotes"] },
} satisfies Readers;
