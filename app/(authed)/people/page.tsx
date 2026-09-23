import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedPeople } from "@/lib/cache/people";
import { PersonCreateButton } from "./person-form";
import { PersonRowItem } from "./person-row";

export default async function PeoplePage() {
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
