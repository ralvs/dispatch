// The people kinds (#30): a person, their facts and their interactions. Three
// kinds, so a fact's write confirms a fact and an edit to the person moves
// /people and the person's own page together. No `updated_at` on facts or
// interactions: an edit is a desired-state patch, and interactions are only
// ever inserted or deleted (lib/store/types.ts).

import type { PersonFactRow, PersonInteractionRow, PersonRow } from "@/lib/schemas/person";
import {
	newestFirst,
	type RecordIntent,
	recordKind,
	recordListView,
} from "@/lib/store/kinds/record";
import type { KindAdapter, ViewAdapter } from "@/lib/store/types";

export type PersonIntent = RecordIntent<PersonRow>;
export type PersonFactIntent = RecordIntent<PersonFactRow>;
export type PersonInteractionIntent = RecordIntent<PersonInteractionRow>;

/** A view of one person — the detail page's header — admits no other. */
export type PersonScope = { id: string };
/** A person's facts or interactions admit only that person's rows. */
export type OfPerson = { personId: string };

export const personKind: KindAdapter<"person"> = recordKind<PersonRow>();
export const personFactKind: KindAdapter<"personFact"> = recordKind<PersonFactRow>();
export const personInteractionKind: KindAdapter<"personInteraction"> =
	recordKind<PersonInteractionRow>();

/** By name, as listPeople orders them. */
const byName = (a: PersonRow, b: PersonRow) => a.name.localeCompare(b.name);

export const personListView: ViewAdapter<"personList"> = {
	kind: "person",
	...recordListView<PersonRow, PersonScope>({
		belongs: (row, scope) => scope === undefined || row.id === scope.id,
		compare: byName,
	}),
};

/** Undated first, then by date; ties by when they were added (listFacts). */
function byFactDate(a: PersonFactRow, b: PersonFactRow): number {
	if (a.date_relevant !== b.date_relevant) {
		if (a.date_relevant === null) return -1;
		if (b.date_relevant === null) return 1;
		return a.date_relevant < b.date_relevant ? -1 : 1;
	}
	return Date.parse(a.created_at) - Date.parse(b.created_at);
}

export const personFactListView: ViewAdapter<"personFactList"> = {
	kind: "personFact",
	...recordListView<PersonFactRow, OfPerson>({
		belongs: (row, scope) => scope !== undefined && row.person_id === scope.personId,
		compare: byFactDate,
	}),
};

export const personInteractionListView: ViewAdapter<"personInteractionList"> = {
	kind: "personInteraction",
	...recordListView<PersonInteractionRow, OfPerson>({
		belongs: (row, scope) => scope !== undefined && row.person_id === scope.personId,
		compare: newestFirst((i) => i.occurred_at),
	}),
};
