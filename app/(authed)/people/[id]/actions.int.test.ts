import { describe, expect, it, vi } from "vitest";
import { createPersonAction } from "@/app/(authed)/people/actions";
import { listFacts } from "@/lib/services/people";
import { ownerClient } from "@/test/integration/clients";
import {
	createFactAction,
	createInteractionAction,
	deletePersonAction,
	updatePersonAction,
} from "./actions";

// What each people action writes and returns, against the real tables: the
// entity store confirms from the returned rows (#30).
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/mutation-feedback/invalidate", () => ({ afterMutation: vi.fn() }));

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

async function newPerson(name: string) {
	const result = await createPersonAction(form({ name, company: "Acme" }));
	if (!result.ok) throw new Error("create failed");
	return result.data.rows[0];
}

describe("people actions against the local database", () => {
	it("create returns the person; a blank name is a field error", async () => {
		const ana = await newPerson("Ana");
		expect(ana).toMatchObject({ name: "Ana", company: "Acme" });
		expect(await createPersonAction(form({ name: "" }))).toMatchObject({
			ok: false,
			fieldErrors: { name: ["Give the person a name."] },
		});
	});

	it("an edit returns the row as it now stands; blank clears a field", async () => {
		const ana = await newPerson("Ana");
		const result = await updatePersonAction(ana.id, form({ name: "Ana Lima", company: "" }));
		expect(result).toMatchObject({
			ok: true,
			data: { rows: [{ id: ana.id, name: "Ana Lima", company: null }] },
		});
	});

	it("a fact and an interaction come back as written", async () => {
		const ana = await newPerson("Ana");
		const fact = await createFactAction(
			ana.id,
			form({ fact_type: "birthday", fact_value: "May 1", date_relevant: "2026-05-01" }),
		);
		expect(fact).toMatchObject({
			ok: true,
			data: { rows: [{ person_id: ana.id, fact_type: "birthday", date_relevant: "2026-05-01" }] },
		});
		const call = await createInteractionAction(
			ana.id,
			form({ interaction_type: "call", notes: "Caught up", occurred_date: "2026-07-10" }),
		);
		expect(call).toMatchObject({
			ok: true,
			data: { rows: [{ person_id: ana.id, notes: "Caught up" }] },
		});
	});

	it("delete answers with the id, and takes the facts with it", async () => {
		const ana = await newPerson("Ana");
		await createFactAction(ana.id, form({ fact_type: "other", fact_value: "x" }));
		expect(await deletePersonAction(ana.id)).toMatchObject({
			ok: true,
			data: { rows: [], deletedIds: [ana.id] },
		});
		expect(await listFacts(await ownerClient(), ana.id)).toEqual([]);
	});
});
