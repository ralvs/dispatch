"use client";

import { useMemo } from "react";
import type { MentionCandidate } from "@/lib/mentions";
import type { PersonRow } from "@/lib/schemas/person";
import { useConfirmedWrites } from "@/lib/store/hooks";
import type { StoreWrite } from "@/lib/store/types";

/**
 * The server's candidates with this tab's confirmed people writes folded on,
 * oldest first: a person created here is offered at once, a rename here shows
 * under the new name, a delete here drops them (#30). Only writes, never
 * seeds — a seed is no newer than the server's list, and a pending create has
 * the client's id, which a mention must never store.
 */
export function mergeMentionPeople(
	server: MentionCandidate[],
	writes: StoreWrite<PersonRow>[],
): MentionCandidate[] {
	if (writes.length === 0) return server;
	const byId = new Map(server.map((c) => [c.id, c]));
	for (const write of writes) {
		for (const row of write.rows) byId.set(row.id, { id: row.id, name: row.name });
		for (const id of write.deletedIds ?? []) byId.delete(id);
	}
	return [...byId.values()];
}

export function useMentionPeople(server: MentionCandidate[]): MentionCandidate[] {
	const writes = useConfirmedWrites("person");
	return useMemo(() => mergeMentionPeople(server, writes), [server, writes]);
}
