import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPerson } from "@/lib/cache/people";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import type { Snapshot } from "@/lib/store/types";
import { PersonDetail } from "./person-detail";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}): Promise<Metadata> {
	const parsedId = z.uuid().safeParse((await params).id);
	if (!parsedId.success) return {};
	// Security boundary first (iron rule #2). Same cached read as the page, so
	// no extra round trip; a missing person leaves the default title and the
	// page's notFound() decides the 404.
	await requireOwnerPage();
	const detail = await getCachedPerson(parsedId.data);
	return detail ? { title: detail.person.name } : {};
}

async function PersonBody({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [detail, tz] = await Promise.all([getCachedPerson(id), getCachedAppTimezone()]);
	if (!detail) notFound();
	const { readAt, person, facts, interactions, mentions } = detail;
	// The person, the facts and the interactions read the entity store (#30).
	const snapshot: Snapshot = {
		readAt,
		todayIso: todayInTz(tz),
		tz,
		views: [
			{ key: viewKey.person(id), type: "personList", data: { rows: [person], scope: { id } } },
			{
				key: viewKey.personFacts(id),
				type: "personFactList",
				data: { rows: facts, scope: { personId: id } },
			},
			{
				key: viewKey.personInteractions(id),
				type: "personInteractionList",
				data: { rows: interactions, scope: { personId: id } },
			},
		],
	};

	return (
		<Seed snapshot={snapshot}>
			<PersonDetail
				personId={id}
				tz={tz}
				mentionedTasks={mentions.tasks as { id: string; title: string; status: string }[]}
				mentionedNotes={mentions.notes as { id: string; title: string | null; body: string }[]}
			/>
		</Seed>
	);
}

// No title: this route's h1 is the person's name, which is the data still in
// flight. PageSkeleton holds the h1's geometry with a placeholder instead.
function PersonFallback() {
	return <PageSkeleton rows={5} />;
}

// The data streams in behind the page's own boundary, so the route keeps no
// loading.tsx (#21). `params` is handed down unawaited: awaiting it here would
// make the whole page one dynamic hole again.
export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
	return (
		<div>
			{/* The way back, as on the note and project pages. Not data, so it
			    sits above the boundary and comes out of the prerendered shell. */}
			<BackLink href="/people" label="People" />
			<Suspense fallback={<PersonFallback />}>
				<PersonBody params={params} />
			</Suspense>
		</div>
	);
}
