import "server-only";
import { nowUtc } from "@/lib/dates";
import type { Clock, Instant, Snapshot, StoreWrite } from "@/lib/store/types";

// Server-side stamps for the store's conflict rule (./types.ts). Imported
// directly, never through the client barrel.

/** A read and the instant it started: the store's version for what it seeds. */
export type Stamped<T> = { readAt: Instant; data: T };

/** Stamp BEFORE the read starts: anything committed later is newer than it. */
export async function stampRead<T>(read: () => Promise<T>): Promise<Stamped<T>> {
	const readAt = nowUtc();
	const data = await read();
	return { data, readAt };
}

/** Call AFTER the write resolves: every read that could miss it started earlier. */
export function stampWrite<R>(rows: R[], deletedIds?: string[]): StoreWrite<R> {
	return { at: nowUtc(), rows, ...(deletedIds && deletedIds.length > 0 ? { deletedIds } : {}) };
}

export type SeedParts = Pick<Snapshot, "views" | "aggregates" | "quietProjectIds">;

/**
 * A page's snapshot: the request's clock plus the stamp of the read it seeds
 * (docs/adr/0078). A page only seeds; `stampRead` is the one stamp.
 */
export function seedOf(
	read: Pick<Stamped<unknown>, "readAt">,
	clock: Clock,
	parts: SeedParts = {},
): Snapshot {
	return { ...clock, ...parts, readAt: read.readAt };
}
