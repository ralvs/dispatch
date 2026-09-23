import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { listEntries } from "@/lib/services/journal";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /journal (docs/adr/0035). Entries arrive from the app and from capture. */
export async function getCachedJournal() {
	"use cache";
	cacheTag(CacheTag.journal);
	cacheLife("tagged");

	return listEntries(createAdminClient());
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedJournal",
		reads: [
			{
				tag: CacheTag.journal,
				writes: ["journal.write", "capture.settled"],
				external: ["capture", "sweep"],
			},
		],
	},
];
