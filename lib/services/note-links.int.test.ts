import { describe, expect, it } from "vitest";
import { createManualLink, syncWikilinks } from "@/lib/services/note-links";
import { createNote } from "@/lib/services/notes";
import { createTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";

// syncWikilinks reconciles a note's kind='wikilink' edges with the ids parsed
// from its body; createManualLink is the idempotent insert behind the link
// rail. Both run against real Postgres + RLS.

const UNKNOWN = "99999999-9999-4999-8999-999999999999";

async function aNote(body = "") {
	return createNote(await ownerClient(), { body });
}

type Edge = { kind: string; target_type: string; target_note_id: string | null };

async function edgesFrom(noteId: string): Promise<Edge[]> {
	const { data, error } = await (await ownerClient())
		.from("note_links")
		.select("kind, target_type, target_note_id, target_task_id")
		.eq("note_id", noteId)
		.order("kind")
		.order("target_note_id");
	if (error) throw error;
	return data as Edge[];
}

async function wikilinkTargets(noteId: string): Promise<string[]> {
	return (await edgesFrom(noteId))
		.filter((e) => e.kind === "wikilink")
		.map((e) => e.target_note_id as string)
		.sort();
}

describe("syncWikilinks", () => {
	it("adds one wikilink edge per target", async () => {
		const sb = await ownerClient();
		const [src, a, b] = await Promise.all([aNote(), aNote(), aNote()]);

		await syncWikilinks(sb, src.id, [a.id, b.id]);

		expect(await wikilinkTargets(src.id)).toEqual([a.id, b.id].sort());
		expect((await edgesFrom(src.id)).every((e) => e.target_type === "note")).toBe(true);
	});

	it("dedupes repeated targets", async () => {
		const sb = await ownerClient();
		const [src, a] = await Promise.all([aNote(), aNote()]);

		await syncWikilinks(sb, src.id, [a.id, a.id]);

		expect(await wikilinkTargets(src.id)).toEqual([a.id]);
	});

	it("removes edges whose target left the body", async () => {
		const sb = await ownerClient();
		const [src, a, b] = await Promise.all([aNote(), aNote(), aNote()]);
		await syncWikilinks(sb, src.id, [a.id, b.id]);

		await syncWikilinks(sb, src.id, [b.id]);

		expect(await wikilinkTargets(src.id)).toEqual([b.id]);
	});

	it("removes every wikilink edge when the body has none", async () => {
		const sb = await ownerClient();
		const [src, a] = await Promise.all([aNote(), aNote()]);
		await syncWikilinks(sb, src.id, [a.id]);

		await syncWikilinks(sb, src.id, []);

		expect(await wikilinkTargets(src.id)).toEqual([]);
	});

	it("is idempotent: a second sync with the same ids leaves the same rows", async () => {
		const sb = await ownerClient();
		const [src, a, b] = await Promise.all([aNote(), aNote(), aNote()]);
		await syncWikilinks(sb, src.id, [a.id, b.id]);
		const { data: before } = await sb.from("note_links").select("id").eq("note_id", src.id);

		await syncWikilinks(sb, src.id, [a.id, b.id]);

		const { data: after } = await sb.from("note_links").select("id").eq("note_id", src.id);
		expect((after ?? []).map((r) => r.id).sort()).toEqual((before ?? []).map((r) => r.id).sort());
	});

	it("skips a target id that matches no note", async () => {
		const sb = await ownerClient();
		const [src, a] = await Promise.all([aNote(), aNote()]);

		await syncWikilinks(sb, src.id, [a.id, UNKNOWN]);

		expect(await wikilinkTargets(src.id)).toEqual([a.id]);
	});

	it("never links a note to itself", async () => {
		const sb = await ownerClient();
		const src = await aNote();

		await syncWikilinks(sb, src.id, [src.id]);

		expect(await wikilinkTargets(src.id)).toEqual([]);
	});

	it("leaves manual links alone, even to the same note", async () => {
		const sb = await ownerClient();
		const [src, a] = await Promise.all([aNote(), aNote()]);
		const task = await createTask(sb, { title: "Linked task" });
		await createManualLink(sb, { note_id: src.id, target_type: "note", target_id: a.id });
		await createManualLink(sb, { note_id: src.id, target_type: "task", target_id: task.id });

		await syncWikilinks(sb, src.id, [a.id]);
		await syncWikilinks(sb, src.id, []);

		const edges = await edgesFrom(src.id);
		expect(edges.filter((e) => e.kind === "manual")).toHaveLength(2);
		expect(edges.filter((e) => e.kind === "wikilink")).toHaveLength(0);
	});
});

describe("createManualLink", () => {
	it("links a note to a task", async () => {
		const sb = await ownerClient();
		const src = await aNote();
		const task = await createTask(sb, { title: "Linked task" });

		const link = await createManualLink(sb, {
			note_id: src.id,
			target_type: "task",
			target_id: task.id,
		});

		expect(link).toMatchObject({
			note_id: src.id,
			target_type: "task",
			kind: "manual",
			target_task_id: task.id,
			target_note_id: null,
			target_event_id: null,
		});
	});

	it("returns the existing row when the edge already exists", async () => {
		const sb = await ownerClient();
		const [src, a] = await Promise.all([aNote(), aNote()]);
		const input = { note_id: src.id, target_type: "note" as const, target_id: a.id };

		const first = await createManualLink(sb, input);
		const second = await createManualLink(sb, input);

		expect(second.id).toBe(first.id);
		expect(await edgesFrom(src.id)).toHaveLength(1);
	});

	it("refuses a target that does not exist", async () => {
		const sb = await ownerClient();
		const src = await aNote();

		await expect(
			createManualLink(sb, { note_id: src.id, target_type: "task", target_id: UNKNOWN }),
		).rejects.toThrow();
	});
});
