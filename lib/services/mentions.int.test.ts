import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
	listMentionsForPerson,
	listMentionsForSources,
	syncMentions,
	syncNoteMentionsFromText,
	syncTaskMentionsFromText,
} from "@/lib/services/mentions";
import { createNote } from "@/lib/services/notes";
import { createPerson } from "@/lib/services/people";
import { createTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";

// @mentions against the real table (#18): the reconcile, the partial unique
// indexes and the people join.

async function mentionRows(column: "task_id" | "note_id", id: string) {
	const sb = await ownerClient();
	const { data, error } = await sb
		.from("mentions")
		.select("id, person_id, matched_name, source_type")
		.eq(column, id)
		.order("matched_name");
	if (error) throw error;
	return data;
}

describe("syncMentions against the local database", () => {
	it("adds new people, drops stale ones, and keeps the rows that still match", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const bia = await createPerson(sb, { name: "Bia" });
		const caio = await createPerson(sb, { name: "Caio" });
		const task = await createTask(sb, { title: "Plain title" });
		const source = { type: "task", id: task.id } as const;

		await syncMentions(sb, source, [
			{ personId: ana.id, name: "Ana" },
			{ personId: bia.id, name: "Bia" },
		]);
		const [anaRow] = await mentionRows("task_id", task.id);

		await syncMentions(sb, source, [
			{ personId: ana.id, name: "Ana renamed" },
			{ personId: caio.id, name: "Caio" },
		]);

		expect(await mentionRows("task_id", task.id)).toEqual([
			// Same row: an existing mention is never rewritten.
			{ id: anaRow.id, person_id: ana.id, matched_name: "Ana", source_type: "task" },
			{ id: expect.any(String), person_id: caio.id, matched_name: "Caio", source_type: "task" },
		]);
	});

	it("skips a person id that does not exist", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Plain title" });

		await syncMentions(sb, { type: "task", id: task.id }, [
			{ personId: randomUUID(), name: "Ghost" },
		]);

		expect(await mentionRows("task_id", task.id)).toEqual([]);
	});

	it("is idempotent, and the first match of a person wins", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const note = await createNote(sb, { body: "plain body" });
		const matches = [
			{ personId: ana.id, name: "Ana" },
			{ personId: ana.id, name: "Ana again" },
		];

		await syncMentions(sb, { type: "note", id: note.id }, matches);
		await syncMentions(sb, { type: "note", id: note.id }, matches);

		expect(await mentionRows("note_id", note.id)).toMatchObject([
			{ person_id: ana.id, matched_name: "Ana", source_type: "note" },
		]);
	});

	it("clears every mention when the text no longer names anyone", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const task = await createTask(sb, { title: "Plain title" });
		await syncMentions(sb, { type: "task", id: task.id }, [{ personId: ana.id, name: "Ana" }]);

		await syncMentions(sb, { type: "task", id: task.id }, []);

		expect(await mentionRows("task_id", task.id)).toEqual([]);
	});
});

describe("mentions from text against the local database", () => {
	it("links a task's plain @Name and a note's structured and plain mentions", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const bia = await createPerson(sb, { name: "Bia" });
		const task = await createTask(sb, { title: "Plain title" });
		const note = await createNote(sb, { body: "plain body" });

		await syncTaskMentionsFromText(sb, task.id, "Call @Ana", "email renan@alves.id");
		await syncNoteMentionsFromText(sb, note.id, `Lunch with @[${bia.id}|Bia] and @Ana`);

		expect(await mentionRows("task_id", task.id)).toMatchObject([{ person_id: ana.id }]);
		expect((await mentionRows("note_id", note.id)).map((r) => r.person_id).sort()).toEqual(
			[ana.id, bia.id].sort(),
		);
	});

	it("lists the people per source, and the tasks and notes per person", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const task = await createTask(sb, { title: "Call @Ana" });
		const note = await createNote(sb, { title: "Lunch", body: "with @Ana" });
		const quiet = await createTask(sb, { title: "Nobody here" });

		const bySource = await listMentionsForSources(sb, "task", [task.id, quiet.id]);
		expect(bySource.get(task.id)).toMatchObject([{ id: ana.id, name: "Ana" }]);
		expect(bySource.has(quiet.id)).toBe(false);

		const byPerson = await listMentionsForPerson(sb, ana.id);
		expect(byPerson.tasks).toEqual([{ id: task.id, title: "Call @Ana", status: "open" }]);
		expect(byPerson.notes).toEqual([{ id: note.id, title: "Lunch", body: "with @Ana" }]);
	});

	it("returns an empty map for no ids", async () => {
		expect((await listMentionsForSources(await ownerClient(), "note", [])).size).toBe(0);
	});
});
