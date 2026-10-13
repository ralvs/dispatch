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
	it("a blank date falls back to the page's today; the form goes to the server as is", async () => {
		const fd = new FormData();
		fd.set("transcription_text", "Dia bom");
		fd.set("tags", "a, b,");
		const w = journalWrites.create(fd, "2026-07-15");
		expect(w.intent).toMatchObject({
			type: "create",
			row: { entry_date: "2026-07-15", transcription_text: "Dia bom", tags: ["a", "b"] },
		});
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
