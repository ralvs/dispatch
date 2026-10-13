import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import { createQuoteAction, deleteQuoteAction } from "./actions";
import { quoteWrites } from "./writes";

vi.mock("./actions", () => ({ createQuoteAction: vi.fn(), deleteQuoteAction: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("quoteWrites", () => {
	it("the new quote shows what the form says; the form goes to the server as is", async () => {
		const fd = new FormData();
		fd.set("text", " Less is more ");
		fd.set("source_type", "book");
		const w = quoteWrites.create(fd);
		expect(w.intent).toMatchObject({
			type: "create",
			row: { text: "Less is more", source_type: "book", tags: [] },
		});
		await w.call(ctx);
		expect(createQuoteAction).toHaveBeenCalledWith(fd);
	});

	it("a delete names the same quote", async () => {
		const w = quoteWrites.remove("q1");
		expect(w.intent).toEqual({ type: "delete", id: "q1" });
		await w.call(ctx);
		expect(deleteQuoteAction).toHaveBeenCalledWith("q1");
	});
});
