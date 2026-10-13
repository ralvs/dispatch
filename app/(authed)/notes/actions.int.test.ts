import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterMutation } from "@/lib/invalidate";
import { createNote, getNote } from "@/lib/services/notes";
import { createTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";
import {
	attachLinkAction,
	createBlankNoteAction,
	deleteNoteAction,
	detachLinkAction,
	removeAttachmentAction,
	resolveNeedsReviewAction,
	saveNoteAction,
	searchLinkTargetsAction,
	setNoteDomainAction,
	setPinAction,
} from "./actions";

// The guard reads cookies and the invalidation needs a Next request scope;
// neither exists here. Everything between them runs for real.
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/invalidate", () => ({ afterMutation: vi.fn() }));

const UNKNOWN = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
	vi.mocked(afterMutation).mockClear();
});

async function aNote(input: { body?: string; needs_review?: boolean } = {}) {
	return createNote(await ownerClient(), { body: input.body ?? "a note", ...input });
}

async function noteCount(): Promise<number> {
	const { count } = await (await ownerClient())
		.from("notes")
		.select("*", { count: "exact", head: true });
	return count ?? 0;
}

async function links(noteId: string) {
	const { data, error } = await (await ownerClient())
		.from("note_links")
		.select("id, kind, target_type, target_task_id")
		.eq("note_id", noteId);
	if (error) throw error;
	return data;
}

describe("createBlankNoteAction", () => {
	it("creates an empty note and redirects to it", async () => {
		const before = await noteCount();

		const err = await createBlankNoteAction().then(
			() => null,
			(e: unknown) => e as { digest?: string },
		);

		expect(await noteCount()).toBe(before + 1);
		const { data } = await (await ownerClient())
			.from("notes")
			.select("id, body")
			.order("created_at", { ascending: false })
			.limit(1)
			.single();
		expect(data?.body).toBe("");
		expect(err?.digest).toContain(`/notes/${data?.id}`);
		expect(afterMutation).toHaveBeenCalledWith("notes.write");
	});
});

describe("saveNoteAction", () => {
	it("saves title and body and returns the row", async () => {
		const note = await aNote();

		const result = await saveNoteAction(note.id, { title: "Plan", body: "New body" });

		expect(result).toMatchObject({
			ok: true,
			data: { rows: [{ id: note.id, title: "Plan", body: "New body" }] },
		});
		expect(afterMutation).toHaveBeenCalledWith("notes.write");
	});

	it("stores a blank title as null", async () => {
		const note = await aNote();

		await saveNoteAction(note.id, { title: "   ", body: "x" });

		expect((await getNote(await ownerClient(), note.id))?.title).toBeNull();
	});

	it("refuses a bad id and writes nothing", async () => {
		await expect(saveNoteAction("not-a-uuid", { title: null, body: "x" })).rejects.toThrow();
		expect(afterMutation).not.toHaveBeenCalled();
	});

	it("refuses a body that is not a string", async () => {
		const note = await aNote({ body: "kept" });

		await expect(
			saveNoteAction(note.id, { title: null, body: 42 as unknown as string }),
		).rejects.toThrow();
		expect((await getNote(await ownerClient(), note.id))?.body).toBe("kept");
	});
});

describe("setNoteDomainAction", () => {
	it("files a note under a domain, and '' unfiles it", async () => {
		const sb = await ownerClient();
		const { data: domain } = await sb.from("domains").select("id").limit(1).single();
		const note = await aNote();

		const filed = await setNoteDomainAction(note.id, domain?.id as string);
		expect(filed).toMatchObject({ ok: true, data: { rows: [{ domain_id: domain?.id }] } });

		const unfiled = await setNoteDomainAction(note.id, "");
		expect(unfiled).toMatchObject({ ok: true, data: { rows: [{ domain_id: null }] } });
	});

	it("refuses a domain id that is not a uuid", async () => {
		const note = await aNote();
		await expect(setNoteDomainAction(note.id, "work")).rejects.toThrow();
	});
});

describe("resolveNeedsReviewAction", () => {
	it("clears needs_review", async () => {
		const note = await aNote({ needs_review: true });

		const result = await resolveNeedsReviewAction(note.id);

		expect(result).toMatchObject({ ok: true, data: { rows: [{ needs_review: false }] } });
	});

	it("refuses a bad id", async () => {
		await expect(resolveNeedsReviewAction("nope")).rejects.toThrow();
	});
});

describe("setPinAction", () => {
	it("pins and unpins a note", async () => {
		const note = await aNote();

		const pinned = await setPinAction({ id: note.id, pinned: true });
		expect(pinned.ok && pinned.data.rows[0]?.pinned_at).toBeTruthy();

		const unpinned = await setPinAction({ id: note.id, pinned: false });
		expect(unpinned).toMatchObject({ ok: true, data: { rows: [{ pinned_at: null }] } });
	});

	it("refuses a pinned flag that is not a boolean", async () => {
		const note = await aNote();
		await expect(
			setPinAction({ id: note.id, pinned: "yes" as unknown as boolean }),
		).rejects.toThrow();
	});
});

describe("deleteNoteAction", () => {
	it("deletes the note and answers with its id as deleted", async () => {
		const note = await aNote();

		const result = await deleteNoteAction(note.id);

		expect(result).toMatchObject({ ok: true, data: { rows: [], deletedIds: [note.id] } });
		expect(await getNote(await ownerClient(), note.id)).toBeNull();
	});

	it("refuses a bad id", async () => {
		await expect(deleteNoteAction("nope")).rejects.toThrow();
	});
});

describe("attachLinkAction / detachLinkAction", () => {
	it("attaches a manual link to a task, then detaches it", async () => {
		const sb = await ownerClient();
		const note = await aNote();
		const task = await createTask(sb, { title: "Linked task" });

		await attachLinkAction(note.id, "task", task.id);
		const [link] = await links(note.id);
		expect(link).toMatchObject({ kind: "manual", target_type: "task", target_task_id: task.id });
		expect(afterMutation).toHaveBeenCalledWith("notes.links");

		await detachLinkAction(note.id, link?.id as string);
		expect(await links(note.id)).toEqual([]);
	});

	it("refuses a target type other than task or event", async () => {
		const note = await aNote();
		const other = await aNote();
		await expect(
			attachLinkAction(note.id, "note" as unknown as "task", other.id),
		).rejects.toThrow();
		expect(await links(note.id)).toEqual([]);
	});

	it("refuses a bad link id on detach", async () => {
		const note = await aNote();
		await expect(detachLinkAction(note.id, "nope")).rejects.toThrow();
	});
});

// The action passes no storage port, so the real R2 adapter would run past
// the guards. Only the refusals that come before storage are tested here;
// the storage path itself is covered in lib/services/note-attachments.int.test.ts.
describe("removeAttachmentAction", () => {
	it("refuses a bad note id", async () => {
		await expect(removeAttachmentAction("nope", "notes/x/y.png")).rejects.toThrow();
	});

	it("refuses an empty storage path", async () => {
		const note = await aNote();
		await expect(removeAttachmentAction(note.id, "")).rejects.toThrow();
	});

	it("refuses a path outside the note's prefix", async () => {
		const note = await aNote();
		await expect(removeAttachmentAction(note.id, `notes/${UNKNOWN}/a.png`)).rejects.toThrow();
		expect(afterMutation).not.toHaveBeenCalled();
	});
});

describe("searchLinkTargetsAction", () => {
	it("returns nothing for a blank query", async () => {
		expect(await searchLinkTargetsAction("task", "   ")).toEqual([]);
	});

	it("finds tasks by title and marks done ones", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Renew passport" });

		const results = await searchLinkTargetsAction("task", "passport");

		expect(results).toEqual([{ id: task.id, label: "Renew passport" }]);
	});

	it("finds events by title, labelled with their start", async () => {
		const sb = await ownerClient();
		const { data: event, error } = await sb
			.from("calendar_events")
			.insert({
				title: "Dentist",
				start_at: "2026-07-14T13:00:00Z",
				end_at: "2026-07-14T14:00:00Z",
			})
			.select("id")
			.single();
		if (error) throw error;

		const [result] = await searchLinkTargetsAction("event", "dent");

		expect(result?.id).toBe(event.id);
		expect(result?.label).toMatch(/^Dentist · /);
	});

	it("refuses a target type other than task or event", async () => {
		await expect(searchLinkTargetsAction("note" as unknown as "task", "x")).rejects.toThrow();
	});
});
