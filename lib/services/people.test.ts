import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createFact, createInteraction, createPerson, deletePerson } from "@/lib/services/people";

// Stub covering .from().insert().select().single() and .from().delete().eq().
function stubSupabase() {
	const inserts: Array<Record<string, unknown>> = [];
	let deleted = false;

	const sb = {
		from: vi.fn(() => ({
			insert: vi.fn((row: Record<string, unknown>) => {
				inserts.push(row);
				return {
					select: vi.fn(() => ({
						single: vi.fn(async () => ({ data: { id: "row-1", ...row }, error: null })),
					})),
				};
			}),
			delete: vi.fn(() => ({
				eq: vi.fn(async () => {
					deleted = true;
					return { data: null, error: null };
				}),
			})),
		})),
	} as unknown as SupabaseClient;

	return { sb, inserts, wasDeleted: () => deleted };
}

describe("createPerson", () => {
	it("stores the given fields", async () => {
		const { sb, inserts } = stubSupabase();

		const person = await createPerson(sb, { name: "Ana", relationship_type: "friend" });

		expect(person.id).toBe("row-1");
		expect(inserts[0]).toMatchObject({ name: "Ana", relationship_type: "friend" });
	});
});

describe("deletePerson", () => {
	it("deletes the row (facts/interactions cascade via FK)", async () => {
		const { sb, wasDeleted } = stubSupabase();

		await deletePerson(sb, "person-1");

		expect(wasDeleted()).toBe(true);
	});
});

describe("createFact", () => {
	it("stores a bare date_relevant unconverted, linked to the person", async () => {
		const { sb, inserts } = stubSupabase();

		await createFact(sb, "person-1", {
			fact_type: "birthday",
			fact_value: "March 3rd",
			date_relevant: "2026-03-03",
		});

		expect(inserts[0]).toMatchObject({
			person_id: "person-1",
			fact_type: "birthday",
			date_relevant: "2026-03-03",
		});
	});
});

describe("createInteraction", () => {
	it("passes occurred_at through as given (conversion happens at the boundary)", async () => {
		const { sb, inserts } = stubSupabase();

		await createInteraction(sb, "person-1", {
			interaction_type: "call",
			occurred_at: "2026-07-15T18:00:00.000Z",
		});

		expect(inserts[0]).toMatchObject({
			person_id: "person-1",
			interaction_type: "call",
			occurred_at: "2026-07-15T18:00:00.000Z",
		});
	});
});
