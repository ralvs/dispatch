"use client";

import { EmptyState, PageHeader } from "@/components/ui";
import type { PersonRow } from "@/lib/schemas/person";
import { useProvisionalIds, useView, viewKey } from "@/lib/store";
import { PersonCreateButton } from "./person-form";
import { PersonRowItem } from "./person-row";

const NO_PEOPLE: PersonRow[] = [];

/**
 * /people from the entity store (#30). A new person shows in its place by name
 * at once, and a rename or a delete on the person's page is already here when
 * you come back.
 */
export function PersonList() {
	const people = useView(viewKey.people()) ?? NO_PEOPLE;
	const saving = useProvisionalIds("person");

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
						<PersonRowItem key={p.id} person={p} saving={saving.has(p.id)} />
					))}
				</ul>
			)}
		</div>
	);
}
