import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { nowUtc } from "@/lib/dates";
import { listMentionsForPerson } from "@/lib/services/mentions";
import { getPerson, listFacts, listInteractions, listPeople } from "@/lib/services/people";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /people (docs/adr/0035). */
export async function getCachedPeople() {
	"use cache";
	cacheTag(CacheTag.people);
	cacheLife("tagged");

	// `readAt` is the entity store's version (lib/store/types.ts), stamped
	// inside the cache so a stale entry keeps its old stamp.
	const readAt = nowUtc();
	const people = await listPeople(createAdminClient());
	return { readAt, people };
}

/**
 * One person, for /people/[id]; null when there is none. Mentions come from
 * task and note text, so a task or note write moves them too.
 */
export async function getCachedPerson(id: string) {
	"use cache";
	cacheTag(CacheTag.people, CacheTag.tasks, CacheTag.notes);
	cacheLife("tagged");

	const readAt = nowUtc();
	const sb = createAdminClient();
	const person = await getPerson(sb, id);
	if (!person) return null;
	const [facts, interactions, mentions] = await Promise.all([
		listFacts(sb, id),
		listInteractions(sb, id),
		listMentionsForPerson(sb, id),
	]);
	return { readAt, person, facts, interactions, mentions };
}

export const readers = {
	getCachedPeople: { tags: [CacheTag.people], tables: ["people"] },
	getCachedPerson: {
		tags: [CacheTag.people, CacheTag.tasks, CacheTag.notes],
		tables: ["people", "person_facts", "person_interactions", "mentions", "tasks", "notes"],
	},
} satisfies Readers;
