"use client";

import type { MentionCandidate } from "@/lib/mentions";
import type { PersonRow } from "@/lib/schemas/person";
import { foldConfirmed, useLiveOptions } from "@/lib/store/live-options";
import type { StoreWrite } from "@/lib/store/types";

const toCandidate = (row: PersonRow): MentionCandidate => ({ id: row.id, name: row.name });

/**
 * The server's @-mention candidates with this tab's confirmed people writes
 * folded on (#30): a person created here is offered at once, a rename here
 * shows under the new name, a delete here drops them. See foldConfirmed.
 */
export function mergeMentionPeople(
	server: MentionCandidate[],
	writes: StoreWrite<PersonRow>[],
): MentionCandidate[] {
	return foldConfirmed(server, writes, toCandidate);
}

export function useMentionPeople(server: MentionCandidate[]): MentionCandidate[] {
	return useLiveOptions("person", server, toCandidate);
}
