import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import {
	deleteNoteAction,
	removeAttachmentAction,
	resolveNeedsReviewAction,
	saveNoteAction,
	setNoteDomainAction,
	setPinAction,
} from "./actions";
import { noteWrites } from "./writes";

vi.mock("./actions", () => ({
	deleteNoteAction: vi.fn(),
	removeAttachmentAction: vi.fn(),
	resolveNeedsReviewAction: vi.fn(),
	saveNoteAction: vi.fn(),
	setNoteDomainAction: vi.fn(),
	setPinAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("noteWrites", () => {
	it("a pin sets the state the row asked for", async () => {
		const w = noteWrites.pin("n1", true);
		expect(w.intent).toEqual({ type: "pin", id: "n1", pinned: true });
		await w.call(ctx);
		expect(setPinAction).toHaveBeenCalledWith({ id: "n1", pinned: true });
		expect(w.errorMessage).toBe("Couldn't update pin.");
		expect(noteWrites.pin("n1", false).intent).toEqual({ type: "pin", id: "n1", pinned: false });
	});

	it("a save sends the title and body the store shows", async () => {
		const w = noteWrites.save("n1", null, "body");
		expect(w.intent).toEqual({ type: "save", id: "n1", title: null, body: "body" });
		await w.call(ctx);
		expect(saveNoteAction).toHaveBeenCalledWith("n1", { title: null, body: "body" });
		expect(w.errorMessage).toBe("Couldn't save note.");
	});

	it("filing under no domain is null in the store and the raw select value on the wire", async () => {
		const w = noteWrites.file("n1", "");
		expect(w.intent).toEqual({ type: "file", id: "n1", domainId: null });
		await w.call(ctx);
		expect(setNoteDomainAction).toHaveBeenCalledWith("n1", "");
		expect(w.errorMessage).toBe("Couldn't file this note.");
		expect(noteWrites.file("n1", "d1").intent).toEqual({ type: "file", id: "n1", domainId: "d1" });
	});

	it("a resolve clears a flagged note", async () => {
		const w = noteWrites.resolve("n1");
		expect(w.intent).toEqual({ type: "resolve", id: "n1", flagged: true });
		await w.call(ctx);
		expect(resolveNeedsReviewAction).toHaveBeenCalledWith("n1");
		expect(w.errorMessage).toBe("Couldn't resolve review flag.");
	});

	it("a delete names the same note", async () => {
		const w = noteWrites.remove("n1", false);
		expect(w.intent).toEqual({ type: "delete", id: "n1", flagged: false });
		await w.call(ctx);
		expect(deleteNoteAction).toHaveBeenCalledWith("n1");
		expect(w.errorMessage).toBe("Couldn't delete note.");
		expect(noteWrites.remove("n1", true).intent).toEqual({
			type: "delete",
			id: "n1",
			flagged: true,
		});
	});

	it("removing a file touches its note", async () => {
		const w = noteWrites.removeAttachment("n1", "n1/a.pdf");
		expect(w.intent).toEqual({ type: "touch", id: "n1" });
		await w.call(ctx);
		expect(removeAttachmentAction).toHaveBeenCalledWith("n1", "n1/a.pdf");
		expect(w.errorMessage).toBe("Couldn't remove the file.");
	});
});
