import { Suspense } from "react";
import { CreateTrigger } from "@/components/create-dialog";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPeople } from "@/lib/cache/people";
import { PersonCreateButton } from "./person-form";
import { PersonRowItem } from "./person-row";

async function PeopleBody() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	const people = await getCachedPeople();

	return (
		<div>
			<PageHeader
				title="People"
				measure={[{ count: people.length, label: people.length === 1 ? "person" : "people" }]}
				action={<PersonCreateButton />}
			/>

			{people.length === 0 ? (
				<EmptyState>No one here yet. Add someone.</EmptyState>
			) : (
				// Single ungrouped list — no SectionHead. The header measure is
				// the count; a lone "People" group label would restate the title.
				<ul>
					{people.map((p) => (
						<PersonRowItem key={p.id} person={p} />
					))}
				</ul>
			)}
		</div>
	);
}

function PeopleFallback() {
	return <PageSkeleton title="People" action={<CreateTrigger label="New person" disabled />} />;
}

// The header carries data (its measure), so the whole body streams in behind
// the page's own boundary and the old loading.tsx is its fallback (#21). The
// async child is where the entity store gets seeded (#26-#30).
export default function PeoplePage() {
	return (
		<Suspense fallback={<PeopleFallback />}>
			<PeopleBody />
		</Suspense>
	);
}
