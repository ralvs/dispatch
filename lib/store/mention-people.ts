"use client";

import { useMemo } from "react";
import type { MentionCandidate } from "@/lib/mentions";
import type { PersonRow } from "@/lib/schemas/person";
import { useRowTable } from "@/lib/store/hooks";
import type { RowEntry } from "@/lib/store/types";

/**
 * The server's candidates with this tab's people writes folded on: a person
 * created here is offered at once, a renamed one under the new name, a deleted
 * one no more (#30). The server's list comes from a cached read that can trail
 * a write by one request, and no page render follows a write.
 */
export function mergeMentionPeople(
	server: MentionCandidate[],
	table: Record<string, RowEntry<PersonRow>>,
): MentionCandidate[] {
	const ids = Object.keys(table);
	if (ids.length === 0) return server;
	const out: MentionCandidate[] = [];
	const seen = new Set<string>();
	for (const candidate of server) {
		seen.add(candidate.id);
		const entry = table[candidate.id];
		if (entry === undefined) out.push(candidate);
		else if (!("deleted" in entry)) out.push({ id: candidate.id, name: entry.row.name });
	}
	for (const id of ids) {
		const entry = table[id];
		if (!seen.has(id) && !("deleted" in entry)) out.push({ id, name: entry.row.name });
	}
	return out;
}

export function useMentionPeople(server: MentionCandidate[]): MentionCandidate[] {
	const table = useRowTable("person");
	return useMemo(() => mergeMentionPeople(server, table), [server, table]);
}
