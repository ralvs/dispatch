import { describe, expect, it } from "vitest";
import { find } from "@/lib/services/find";
import { createNote } from "@/lib/services/notes";
import { completeTask, createTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";

// Find against the real tables (#18): the ilike filters and the PostgREST
// `or()` string are what a stub could not check. The migrations seed one
// note, "Link Inbox".

const TODAY = "2026-09-22";

describe("find against the local database", () => {
	it("returns open tasks and the newest notes as recents for a short query", async () => {
		const sb = await ownerClient();
		await createTask(sb, { title: "Buy milk" });
		const done = await createTask(sb, { title: "Old chore" });
		await completeTask(sb, done.id, TODAY, { dueDate: null });
		await createNote(sb, { title: "Plan", body: "x" });

		const result = await find(sb, "d");

		expect(result.recents).toBe(true);
		expect(result.tasks.map((t) => t.title)).toEqual(["Buy milk"]);
		expect(result.notes.map((n) => n.title)).toEqual(["Plan", "Link Inbox"]);
	});

	it("matches a task's title or notes, and a note's title or body, ignoring case", async () => {
		const sb = await ownerClient();
		const byNotes = await createTask(sb, { title: "Convênio", notes: "retorno do Dentista" });
		await createTask(sb, { title: "Unrelated" });
		const byBody = await createNote(sb, { title: "Plano", body: "cobertura do dentista" });

		const result = await find(sb, "dentista");

		expect(result.recents).toBe(false);
		expect(result.tasks).toMatchObject([
			{ id: byNotes.id, field: "notes", href: `/tasks/${byNotes.id}` },
		]);
		expect(result.tasks[0]?.snippet).toContain("Dentista");
		expect(result.notes).toMatchObject([
			{ id: byBody.id, field: "body", href: `/notes/${byBody.id}` },
		]);
	});

	it("ranks a title hit above a notes hit, and keeps done tasks", async () => {
		const sb = await ownerClient();
		const titleHit = await createTask(sb, { title: "Marcar dentista" });
		await completeTask(sb, titleHit.id, TODAY, { dueDate: null });
		const notesHit = await createTask(sb, { title: "Convênio", notes: "dentista" });

		const result = await find(sb, "dentista");

		expect(result.tasks.map((t) => [t.id, t.status])).toEqual([
			[titleHit.id, "done"],
			[notesHit.id, "open"],
		]);
	});

	it("matches % and _ literally", async () => {
		const sb = await ownerClient();
		await createTask(sb, { title: "Raise 100% of the fund" });
		await createTask(sb, { title: "Raise 1000 of the fund" });
		await createTask(sb, { title: "snake_case rename" });
		await createTask(sb, { title: "snakeXcase rename" });

		expect((await find(sb, "100%")).tasks.map((t) => t.title)).toEqual(["Raise 100% of the fund"]);
		expect((await find(sb, "snake_case")).tasks.map((t) => t.title)).toEqual(["snake_case rename"]);
	});

	it("survives a query with the characters that split an or() filter", async () => {
		const sb = await ownerClient();
		await createTask(sb, { title: "Call mom (urgent)" });

		expect((await find(sb, "mom, (urgent)")).tasks).toEqual([]);
		expect((await find(sb, "(urgent)")).tasks.map((t) => t.title)).toEqual(["Call mom (urgent)"]);
	});
});
