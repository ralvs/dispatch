import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import { createEntryAction, deleteEntryAction } from "./actions";
import { journalWrites } from "./writes";

vi.mock("./actions", () => ({ createEntryAction: vi.fn(), deleteEntryAction: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("journalWrites", () => {
	it("a blank date is the page's today on both halves", async () => {
		const fd = new FormData();
		fd.set("transcription_text", "Dia bom");
		fd.set("tags", "a, b,");
		const w = journalWrites.create(fd, "2026-07-15");
		expect(w.intent).toMatchObject({
			type: "create",
			row: { entry_date: "2026-07-15", transcription_text: "Dia bom", tags: ["a", "b"] },
		});
		await w.call(ctx);
		const sent = vi.mocked(createEntryAction).mock.calls[0][0];
		expect(sent.get("entry_date")).toBe("2026-07-15");
		expect(sent.get("transcription_text")).toBe("Dia bom");
		expect(fd.get("entry_date")).toBeNull();
	});

	it("a picked date goes to the server as is", async () => {
		const fd = new FormData();
		fd.set("entry_date", "2026-07-01");
		const w = journalWrites.create(fd, "2026-07-15");
		expect(w.intent).toMatchObject({ row: { entry_date: "2026-07-01" } });
		await w.call(ctx);
		expect(createEntryAction).toHaveBeenCalledWith(fd);
	});

	it("a delete names the same entry", async () => {
		const w = journalWrites.remove("e1");
		expect(w.intent).toEqual({ type: "delete", id: "e1" });
		await w.call(ctx);
		expect(deleteEntryAction).toHaveBeenCalledWith("e1");
	});
});
