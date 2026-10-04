import { describe, expect, it } from "vitest";
import { shiftDay } from "@/lib/dates";
import { ROUTINE_HISTORY_DAYS } from "@/lib/routine-stats";
import { createDomain } from "@/lib/services/domains";
import { createNote, deleteNote } from "@/lib/services/notes";
import { createPerson, deletePerson } from "@/lib/services/people";
import { createProject } from "@/lib/services/projects";
import { createRoutine, setCompletion } from "@/lib/services/routines";
import { todayForRequest } from "@/lib/services/settings";
import { createTask, deleteTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";
import { written } from "./written";

// The one read-back (docs/adr/0077): the row a write left, or its id as
// deleted, for each kind an action reads back.

const GONE = "00000000-0000-4000-8000-00000000dead";

describe("written against the local database", () => {
	it("task: the row comes back with `also` after it; a deleted one keeps `also`", async () => {
		const sb = await ownerClient();
		const t = await createTask(sb, { title: "Water plants" });
		const next = await createTask(sb, { title: "Water plants again" });

		const write = await written(sb, "task", t.id, { also: [next] });
		expect(write.rows.map((r) => r.id)).toEqual([t.id, next.id]);
		expect(write.deletedIds).toBeUndefined();

		await deleteTask(sb, t.id);
		const gone = await written(sb, "task", t.id, { also: [next] });
		expect(gone.rows.map((r) => r.id)).toEqual([next.id]);
		expect(gone.deletedIds).toEqual([t.id]);
	});

	it("routine: the log respects the history window from todayIso", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const r = await createRoutine(sb, { name: "Stretch" });
		const inside = shiftDay(today, -ROUTINE_HISTORY_DAYS);
		const outside = shiftDay(today, -ROUTINE_HISTORY_DAYS - 1);
		for (const day of [today, inside, outside]) await setCompletion(sb, r.id, day, true);

		expect((await written(sb, "routine", r.id)).rows[0]?.completions).toEqual([inside, today]);
		// A todayIso one day back moves the window with it.
		expect(
			(await written(sb, "routine", r.id, { todayIso: shiftDay(today, -1) })).rows[0]?.completions,
		).toEqual([outside, inside, today]);
		expect((await written(sb, "routine", GONE)).deletedIds).toEqual([GONE]);
	});

	it("note: the row comes back; a deleted note is a deleted id", async () => {
		const sb = await ownerClient();
		const n = await createNote(sb, { title: "Plan", body: "x" });
		expect((await written(sb, "note", n.id)).rows).toMatchObject([{ id: n.id, title: "Plan" }]);
		await deleteNote(sb, n.id);
		expect(await written(sb, "note", n.id)).toMatchObject({ rows: [], deletedIds: [n.id] });
	});

	it("person: the row comes back; a deleted person is a deleted id", async () => {
		const sb = await ownerClient();
		const p = await createPerson(sb, { name: "Ana" });
		expect((await written(sb, "person", p.id)).rows).toMatchObject([{ id: p.id, name: "Ana" }]);
		await deletePerson(sb, p.id);
		expect(await written(sb, "person", p.id)).toMatchObject({ rows: [], deletedIds: [p.id] });
	});

	it("domain and project: the row comes back as the store holds it; an unknown id is deleted", async () => {
		const sb = await ownerClient();
		const d = await createDomain(sb, { name: "Gardening" });
		const p = await createProject(sb, { name: "Rebuild deck", domain_id: d.id });

		expect((await written(sb, "domain", d.id)).rows).toMatchObject([
			{ id: d.id, name: "Gardening" },
		]);
		expect((await written(sb, "project", p.id)).rows).toMatchObject([
			{ id: p.id, name: "Rebuild deck" },
		]);
		expect((await written(sb, "domain", GONE)).deletedIds).toEqual([GONE]);
		expect((await written(sb, "project", GONE)).deletedIds).toEqual([GONE]);
	});
});
