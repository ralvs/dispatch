import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listPeople } from "@/lib/services/people";
import { PersonCreateButton } from "./person-form";
import { PersonRowItem } from "./person-row";

export default async function PeoplePage() {
	const { sb } = await requireOwnerPage();
	const people = await listPeople(sb);

	return (
		<div>
			<PageHeader
				title="People"
				measure={[{ count: people.length, label: people.length === 1 ? "person" : "people" }]}
				action={<PersonCreateButton />}
			/>

			<section aria-label="People">
				{people.length === 0 ? (
					<EmptyState>No one here yet. Add someone.</EmptyState>
				) : (
					<ul>
						{people.map((p) => (
							<PersonRowItem key={p.id} person={p} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
