import "server-only";
import { cachedRead, type Readers } from "@/lib/cache/reader";
import { CacheTag } from "@/lib/cache/tags";
import { listMentionsForPerson } from "@/lib/services/mentions";
import { getPerson, listFacts, listInteractions, listPeople } from "@/lib/services/people";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cross-request cache for /people (docs/adr/0035). */
export async function getCachedPeople() {
	"use cache";
	return cachedRead(readers.getCachedPeople, async () => ({
		people: await listPeople(createAdminClient()),
	}));
}

/**
 * One person, for /people/[id]; null when there is none. Mentions come from
 * task and note text, so a task or note write moves them too.
 */
export async function getCachedPerson(id: string) {
	"use cache";
	return cachedRead(readers.getCachedPerson, async () => {
		const sb = createAdminClient();
		const person = await getPerson(sb, id);
		if (!person) return null;
		const [facts, interactions, mentions] = await Promise.all([
			listFacts(sb, id),
			listInteractions(sb, id),
			listMentionsForPerson(sb, id),
		]);
		return { person, facts, interactions, mentions };
	});
}

export const readers = {
	getCachedPeople: { tags: [CacheTag.people], tables: ["people"] },
	getCachedPerson: {
		tags: [CacheTag.people, CacheTag.tasks, CacheTag.notes],
		tables: ["people", "person_facts", "person_interactions", "mentions", "tasks", "notes"],
	},
} satisfies Readers;
