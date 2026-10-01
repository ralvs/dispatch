import { describe, expect, it } from "vitest";
import {
	createFact,
	createInteraction,
	createPerson,
	deletePerson,
	getPerson,
	listFacts,
	listInteractions,
} from "@/lib/services/people";
import { ownerClient } from "@/test/integration/clients";

describe("people against the local database", () => {
	it("stores the given fields", async () => {
		const sb = await ownerClient();
		const person = await createPerson(sb, { name: "Ana", relationship_type: "friend" });

		expect(await getPerson(sb, person.id)).toMatchObject({
			name: "Ana",
			relationship_type: "friend",
		});
	});

	it("stores a bare date_relevant unconverted, linked to the person", async () => {
		const sb = await ownerClient();
		const person = await createPerson(sb, { name: "Ana" });
		await createFact(sb, person.id, {
			fact_type: "birthday",
			fact_value: "March 3rd",
			date_relevant: "2026-03-03",
		});

		expect(await listFacts(sb, person.id)).toMatchObject([
			{ person_id: person.id, fact_type: "birthday", date_relevant: "2026-03-03" },
		]);
	});

	it("stores occurred_at as the UTC instant it was given", async () => {
		const sb = await ownerClient();
		const person = await createPerson(sb, { name: "Ana" });
		await createInteraction(sb, person.id, {
			interaction_type: "call",
			occurred_at: "2026-07-15T18:00:00.000Z",
		});

		const [row] = await listInteractions(sb, person.id);
		expect(row).toMatchObject({ person_id: person.id, interaction_type: "call" });
		expect(new Date(row.occurred_at).toISOString()).toBe("2026-07-15T18:00:00.000Z");
	});

	it("deletes the person and cascades to facts and interactions", async () => {
		const sb = await ownerClient();
		const person = await createPerson(sb, { name: "Ana" });
		await createFact(sb, person.id, { fact_type: "birthday", fact_value: "March 3rd" });
		await createInteraction(sb, person.id, {
			interaction_type: "call",
			occurred_at: "2026-07-15T18:00:00.000Z",
		});

		await deletePerson(sb, person.id);

		expect(await getPerson(sb, person.id)).toBeNull();
		expect(await listFacts(sb, person.id)).toEqual([]);
		expect(await listInteractions(sb, person.id)).toEqual([]);
	});
});
