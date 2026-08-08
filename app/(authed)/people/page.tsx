import { EmptyState, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listPeople } from "@/lib/services/people";
import { PersonForm } from "./person-form";
import { PersonRowItem } from "./person-row";

export default async function PeoplePage() {
	const { sb } = await requireOwnerPage();
	const people = await listPeople(sb);

	return (
		<div>
			<PageHeader
				title="People"
				measure={[{ count: people.length, label: people.length === 1 ? "person" : "people" }]}
			/>

			<section>
				<PersonForm />
			</section>

			<section className="mt-6" aria-label="People">
				{people.length === 0 ? (
					<EmptyState>No one here yet. Add someone.</EmptyState>
				) : (
					<ul className="mt-2">
						{people.map((p) => (
							<PersonRowItem key={p.id} person={p} />
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
