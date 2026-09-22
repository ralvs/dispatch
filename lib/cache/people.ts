import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { CachedReader } from "@/lib/cache/manifest";
import { CacheTag } from "@/lib/cache/tags";
import { listMentionsForPerson } from "@/lib/services/mentions";
import { getPerson, listFacts, listInteractions, listPeople } from "@/lib/services/people";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /people (docs/adr/0035). */
export async function getCachedPeople() {
	"use cache";
	cacheTag(CacheTag.people);
	cacheLife("tagged");

	return listPeople(createAdminClient());
}

/**
 * One person, for /people/[id]; null when there is none. Mentions come from
 * task and note text, so a task or note write moves them too.
 */
export async function getCachedPerson(id: string) {
	"use cache";
	cacheTag(CacheTag.people, CacheTag.tasks, CacheTag.notes);
	cacheLife("tagged");

	const sb = createAdminClient();
	const person = await getPerson(sb, id);
	if (!person) return null;
	const [facts, interactions, mentions] = await Promise.all([
		listFacts(sb, id),
		listInteractions(sb, id),
		listMentionsForPerson(sb, id),
	]);
	return { person, facts, interactions, mentions };
}

export const readers: CachedReader[] = [
	{
		reader: "getCachedPeople",
		reads: [{ tag: CacheTag.people, writes: ["people.write"] }],
	},
	{
		reader: "getCachedPerson",
		reads: [
			{ tag: CacheTag.people, writes: ["people.write"] },
			{
				tag: CacheTag.tasks,
				writes: ["task.write", "task.assign", "capture.settled"],
				external: ["capture", "sweep"],
			},
			{
				tag: CacheTag.notes,
				writes: ["notes.write", "capture.settled"],
				external: ["capture", "sweep"],
			},
		],
	},
];
