"use client";

import { useMemo } from "react";
import { useConfirmedWrites } from "@/lib/store/hooks";
import type { EntityMap, Kind, StoreWrite } from "@/lib/store/types";

/**
 * A server-read option list with this tab's confirmed writes of a kind folded
 * on, oldest first: a row created here is offered at once, an edit here shows,
 * a delete here — or a row `toItem` maps to null, such as an archived domain —
 * drops it. Only confirmed writes, never seeds or pending creates: a seed is no
 * newer than the server's list, and a pending create has the client's id.
 *
 * Why: a picker reads a cached list that trails a write by one request
 * (revalidateTag "max", lib/invalidate.ts), and no page
 * render follows a write (#31). Left on purpose: the server's list carries no
 * read time, so an edit made here keeps winning over a later edit of the same
 * row made elsewhere, for the life of this tab.
 */
export function foldConfirmed<R extends { id: string }, T extends { id: string }>(
	server: readonly T[],
	writes: readonly StoreWrite<R>[],
	toItem: (row: R) => T | null,
): T[] {
	if (writes.length === 0) return server as T[];
	const byId = new Map(server.map((item) => [item.id, item]));
	for (const write of writes) {
		for (const row of write.rows) {
			const item = toItem(row);
			if (item) byId.set(row.id, item);
			else byId.delete(row.id);
		}
		for (const id of write.deletedIds ?? []) byId.delete(id);
	}
	return [...byId.values()];
}

/** `foldConfirmed` over this tab's writes of `kind`. Pass a module-level `toItem`. */
export function useLiveOptions<K extends Kind, T extends { id: string }>(
	kind: K,
	server: readonly T[],
	toItem: (row: EntityMap[K]) => T | null,
): T[] {
	const writes = useConfirmedWrites(kind);
	return useMemo(() => foldConfirmed(server, writes, toItem), [server, writes, toItem]);
}
