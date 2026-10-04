import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import {
	BackLink,
	ListRow,
	PageSkeleton,
	PillBone,
	repeat,
	TextBone,
	TitleMetaBone,
	TriggerBone,
} from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPerson } from "@/lib/cache/people";
import { readClock } from "@/lib/cache/settings";
import { viewKey } from "@/lib/store/keys";
import { Seed } from "@/lib/store/seed";
import { seedOf } from "@/lib/store/server";
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
	return detail.data ? { title: detail.data.person.name } : {};
}

async function PersonBody({ params }: { params: Promise<{ id: string }> }) {
	const { id: rawId } = await params;
	const parsedId = z.uuid().safeParse(rawId);
	if (!parsedId.success) notFound();
	const id = parsedId.data;

	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const [detail, clock] = await Promise.all([getCachedPerson(id), readClock()]);
	if (!detail.data) notFound();
	const { person, facts, interactions, mentions } = detail.data;
	// The person, the facts and the interactions read the entity store (#30).
	const snapshot = seedOf(detail, clock, {
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
	});

	return (
		<Seed snapshot={snapshot}>
			<PersonDetail
				personId={id}
				tz={clock.tz}
				mentionedTasks={mentions.tasks as { id: string; title: string; status: string }[]}
				mentionedNotes={mentions.notes as { id: string; title: string | null; body: string }[]}
			/>
		</Seed>
	);
}

// PersonDetail's silhouette: relationship, company, email and phone, the
// EDIT / DELETE pills, then Facts and Interactions — a couple of rows over the
// "+ Add …" trigger each. No title: this route's h1 is the person's name,
// which is the data still in flight; PageSkeleton holds its geometry.
function PersonFallback() {
	return (
		<PageSkeleton measure={["w-14"]}>
			<div aria-hidden="true">
				<div className="grid grid-cols-2 gap-2 text-sm">
					{repeat(4, (i) => (
						<div key={i}>
							<TextBone className="font-mono text-eyebrow" width="w-24" />
							<TextBone width={i % 2 === 0 ? "w-20" : "w-28"} />
						</div>
					))}
				</div>
				<div className="mt-3 flex gap-2">
					<PillBone width="w-14" />
					<PillBone width="w-[72px]" />
				</div>
				{["w-12", "w-24"].map((title, s) => (
					<section key={title} className="mt-9">
						<div className="mb-1.5 flex items-baseline gap-2">
							<TextBone className="type-section" width={title} />
						</div>
						<ul>
							{repeat(2, (i) => (
								<ListRow key={i}>
									<TitleMetaBone i={i + s * 2} />
								</ListRow>
							))}
						</ul>
						<div className="mt-3">
							<TriggerBone />
						</div>
					</section>
				))}
			</div>
		</PageSkeleton>
	);
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
