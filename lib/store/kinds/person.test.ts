import { describe, expect, it } from "vitest";
import { applyIntent, applySeed, confirmWrite, initialState, selectView } from "@/lib/store/core";
import { viewKey } from "@/lib/store/keys";
import { foldConfirmed } from "@/lib/store/live-options";
import {
	NOW,
	person,
	personFact,
	personInteraction,
	snapshot,
	T1,
	T2,
} from "@/lib/store/test-fixtures";
import type { StoreState } from "@/lib/store/types";

const ana = person({ id: "ana", name: "Ana" });
const caio = person({ id: "caio", name: "Caio" });
const ids = (rows: { id: string }[] | undefined) => rows?.map((r) => r.id);

function seeded(): StoreState {
	return applySeed(
		initialState(),
		snapshot(T1, [
			{ key: viewKey.people(), type: "personList", data: { rows: [ana, caio] } },
			{
				key: viewKey.person("ana"),
				type: "personList",
				data: { rows: [ana], scope: { id: "ana" } },
			},
			{
				key: viewKey.personFacts("ana"),
				type: "personFactList",
				data: {
					rows: [
						personFact({ id: "undated", person_id: "ana" }),
						personFact({ id: "may", person_id: "ana", date_relevant: "2026-05-01" }),
					],
					scope: { personId: "ana" },
				},
			},
			{
				key: viewKey.personInteractions("ana"),
				type: "personInteractionList",
				data: {
					rows: [personInteraction({ id: "call", person_id: "ana" })],
					scope: { personId: "ana" },
				},
			},
		]),
	);
}

describe("people kinds", () => {
	it("a new person takes their place by name; the person page admits only its own", () => {
		const [s1, t] = applyIntent(
			seeded(),
			{ kind: "person", intent: { type: "create", row: person({ id: "tmp", name: "Bia" }) } },
			NOW,
		);
		expect(ids(selectView(s1, viewKey.people()))).toEqual(["ana", "tmp", "caio"]);
		const s2 = confirmWrite(s1, t, { at: T2, rows: [person({ id: "bia", name: "Bia" })] });
		expect(ids(selectView(s2, viewKey.people()))).toEqual(["ana", "bia", "caio"]);
		expect(ids(selectView(s2, viewKey.person("ana")))).toEqual(["ana"]);
	});

	it("a rename on the person page reaches /people, re-sorted once the server confirms it", () => {
		const [s1, t] = applyIntent(
			seeded(),
			{ kind: "person", intent: { type: "patch", id: "ana", patch: { name: "Zoe" } } },
			NOW,
		);
		expect(selectView(s1, viewKey.person("ana"))?.[0].name).toBe("Zoe");
		const s2 = confirmWrite(s1, t, { at: T2, rows: [{ ...ana, name: "Zoe" }] });
		expect(selectView(s2, viewKey.people())?.map((p) => p.name)).toEqual(["Caio", "Zoe"]);
	});

	it("a deleted person leaves both views", () => {
		const [s1] = applyIntent(
			seeded(),
			{ kind: "person", intent: { type: "delete", id: "ana" } },
			NOW,
		);
		expect(selectView(s1, viewKey.person("ana"))).toEqual([]);
		expect(ids(selectView(s1, viewKey.people()))).toEqual(["caio"]);
	});

	it("facts: undated first, then by date; another person's fact is not admitted", () => {
		let s = seeded();
		for (const row of [
			personFact({ id: "jan", person_id: "ana", date_relevant: "2026-01-01" }),
			personFact({ id: "elsewhere", person_id: "caio" }),
		]) {
			[s] = applyIntent(s, { kind: "personFact", intent: { type: "create", row } }, NOW);
		}
		expect(ids(selectView(s, viewKey.personFacts("ana")))).toEqual(["undated", "jan", "may"]);
	});

	it("interactions: newest first", () => {
		const [s1] = applyIntent(
			seeded(),
			{
				kind: "personInteraction",
				intent: {
					type: "create",
					row: personInteraction({
						id: "coffee",
						person_id: "ana",
						occurred_at: "2026-07-15T12:00:00.000Z",
					}),
				},
			},
			NOW,
		);
		expect(ids(selectView(s1, viewKey.personInteractions("ana")))).toEqual(["coffee", "call"]);
	});
});

// The @-mention candidates fold this tab's confirmed people writes on top of the
// server's list (useMentionPeople).
describe("foldConfirmed", () => {
	const toCandidate = (row: { id: string; name: string }) => ({ id: row.id, name: row.name });
	const server = [
		{ id: "ana", name: "Ana" },
		{ id: "caio", name: "Caio" },
	];

	it("is the server's list when this tab wrote no one", () => {
		expect(foldConfirmed(server, [], toCandidate)).toBe(server);
	});

	it("folds this tab's writes on in order: a create, a rename, a delete", () => {
		expect(
			foldConfirmed(
				server,
				[
					{ at: T1, rows: [person({ id: "bia", name: "Bia" })] },
					{ at: T2, rows: [person({ id: "ana", name: "Ana Lima" })] },
					{ at: T2, rows: [], deletedIds: ["caio"] },
				],
				toCandidate,
			),
		).toEqual([
			{ id: "ana", name: "Ana Lima" },
			{ id: "bia", name: "Bia" },
		]);
	});
});
