import { describe, expect, it } from "vitest";
import {
	createRoutine,
	deleteRoutine,
	getRoutineWithHistory,
	listCompletionsForRoutines,
	listRoutines,
	setCompletion,
	updateRoutine,
} from "@/lib/services/routines";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// Routines against the real tables (#18): what a write changes, and the row a
// write returns to the entity store (#29).

const TODAY = "2026-09-22";
const YESTERDAY = "2026-09-21";
const LONG_AGO = "2026-06-01";

describe("routines against the local database", () => {
	it("a double tick is one completion; an untick removes it", async () => {
		const sb = await ownerClient();
		const r = await createRoutine(sb, { name: "Stretch" });

		await setCompletion(sb, r.id, TODAY, true);
		await setCompletion(sb, r.id, TODAY, true);
		expect((await getRoutineWithHistory(sb, r.id, LONG_AGO))?.completions).toEqual([TODAY]);

		await setCompletion(sb, r.id, TODAY, false);
		// Unticking a day that has no completion is a silent no-op.
		await setCompletion(sb, r.id, YESTERDAY, false);
		expect((await getRoutineWithHistory(sb, r.id, LONG_AGO))?.completions).toEqual([]);
	});

	it("returns the routine with its log since the window start, ascending", async () => {
		const sb = await ownerClient();
		const r = await createRoutine(sb, { name: "Read", time_of_day: "evening" });
		for (const day of [TODAY, LONG_AGO, YESTERDAY]) await setCompletion(sb, r.id, day, true);
		await updateRoutine(sb, r.id, { name: "Read 20 pages" });

		const row = await getRoutineWithHistory(sb, r.id, "2026-09-01");
		expect(row).toMatchObject({ id: r.id, name: "Read 20 pages", time_of_day: "evening" });
		expect(row?.completions).toEqual([YESTERDAY, TODAY]);
	});

	it("a deleted routine comes back as null, and its completions go with it", async () => {
		const sb = await ownerClient();
		const r = await createRoutine(sb, { name: "Floss" });
		await setCompletion(sb, r.id, TODAY, true);
		await deleteRoutine(sb, r.id);

		expect(await getRoutineWithHistory(sb, r.id, LONG_AGO)).toBeNull();
		const { data } = await serviceClient()
			.from("routine_completions")
			.select("id")
			.eq("routine_id", r.id);
		expect(data).toEqual([]);
	});

	it("groups completions by routine for the list", async () => {
		const sb = await ownerClient();
		const a = await createRoutine(sb, { name: "A" });
		const b = await createRoutine(sb, { name: "B" });
		await setCompletion(sb, a.id, TODAY, true);
		await setCompletion(sb, a.id, YESTERDAY, true);
		await setCompletion(sb, b.id, TODAY, true);

		const byRoutine = await listCompletionsForRoutines(sb, [a.id, b.id], YESTERDAY);
		expect(byRoutine[a.id].map((c) => c.completed_date)).toEqual([YESTERDAY, TODAY]);
		expect(byRoutine[b.id].map((c) => c.completed_date)).toEqual([TODAY]);
		expect(await listCompletionsForRoutines(sb, [], YESTERDAY)).toEqual({});
		expect((await listRoutines(sb)).map((r) => r.name)).toEqual(expect.arrayContaining(["A", "B"]));
	});

	it("RLS closes routines to a client with no session", async () => {
		const sb = await ownerClient();
		await createRoutine(sb, { name: "Hidden" });
		expect(await listRoutines(anonClient())).toEqual([]);
	});
});
