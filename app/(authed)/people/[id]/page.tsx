import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnerPage } from "@/lib/auth";
import { listMentionsForPerson } from "@/lib/services/mentions";
import { getPerson, listFacts, listInteractions } from "@/lib/services/people";
import { getAppTimezone } from "@/lib/services/settings";
import { PersonDetail } from "./person-detail";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	const { sb } = await requireOwnerPage();
	const person = await getPerson(sb, id);
	if (!person) notFound();

	const [facts, interactions, tz, mentions] = await Promise.all([
		listFacts(sb, id),
		listInteractions(sb, id),
		getAppTimezone(sb),
		listMentionsForPerson(sb, id),
	]);

	return (
		<PersonDetail
			person={person}
			facts={facts}
			interactions={interactions}
			tz={tz}
			mentionedTasks={mentions.tasks as { id: string; title: string; status: string }[]}
			mentionedNotes={mentions.notes as { id: string; title: string | null; body: string }[]}
		/>
	);
}
