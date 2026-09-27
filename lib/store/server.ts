import "server-only";
import { nowUtc } from "@/lib/dates";
import type { Instant, StoreWrite } from "@/lib/store/types";

// Server-side stamps for the store's conflict rule (./types.ts). Imported
// directly, never through the client barrel.

/** Stamp BEFORE the read starts: anything committed later is newer than it. */
export async function stampRead<T>(read: () => Promise<T>): Promise<{ data: T; readAt: Instant }> {
	const readAt = nowUtc();
	const data = await read();
	return { data, readAt };
}

/** Call AFTER the write resolves: every read that could miss it started earlier. */
export function stampWrite<R>(rows: R[], deletedIds?: string[]): StoreWrite<R> {
	return { at: nowUtc(), rows, ...(deletedIds && deletedIds.length > 0 ? { deletedIds } : {}) };
}
