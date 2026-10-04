import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listEntries } from "@/lib/services/journal";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /journal (docs/adr/0035). Entries arrive from the app and from capture. */
export async function getCachedJournal() {
	"use cache";
	return cachedRead(readers.getCachedJournal, async () => ({
		entries: await listEntries(createAdminClient()),
	}));
}

export const readers = {
	getCachedJournal: { tags: [CacheTag.journal], tables: ["journal_entries"] },
} satisfies Readers;
