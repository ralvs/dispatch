import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listLedger, unreadCount } from "@/lib/services/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cross-request cache for /notifications (docs/adr/0035). Almost every row is
 * written from outside the app (iron rule #6), so this entry is only as fresh
 * as the ledger's own bust: lib/services/notifications.ts busts
 * EXTERNAL_WRITES.ledger for every row it records, from any caller
 * (docs/adr/0075).
 */
export async function getCachedNotifications() {
	"use cache";
	return cachedRead(readers.getCachedNotifications, async () => {
		const sb = createAdminClient();
		// The exact unread count, not the list's: the list stops at 100 rows.
		// Unread rows come first (ADR-0080), so a failure is never cut off.
		const [notifications, unread] = await Promise.all([
			listLedger(sb, { limit: 100 }),
			unreadCount(sb),
		]);
		return { notifications, unread };
	});
}

export const readers = {
	getCachedNotifications: { tags: [CacheTag.notifications], tables: ["notifications"] },
} satisfies Readers;
