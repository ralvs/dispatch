import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTag } from "@/lib/cache/tags";
import { listNotes } from "@/lib/services/notes";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /notes (docs/adr/0035). Admin client after
 * requireOwnerPage(), as in lib/cache/today.ts.
 *
 * The needs_review band is written by the sweep cron as well as by the app, so
 * this entry depends on app/api/cron/sweep busting `notes` — it does.
 */
export async function getCachedNoteLists() {
	"use cache";
	cacheTag(CacheTag.notes);
	cacheLife({ stale: 60, revalidate: 300, expire: 900 });

	const sb = createAdminClient();
	const [needsReview, allNotes] = await Promise.all([
		listNotes(sb, { needsReview: true }),
		listNotes(sb, { needsReview: false }),
	]);
	return { needsReview, allNotes };
}
