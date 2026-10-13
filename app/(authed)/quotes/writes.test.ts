import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuoteForm } from "@/lib/schemas/quote";
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

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

// One decode, two halves (docs/adr/0087): what the server parses is what the
// list shows, and a form the server refuses shows nothing.
const cases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	row?: Record<string, unknown>;
}[] = [
	{
		name: "text and a source",
		fields: { text: " Less is more ", source_type: "book", source_author: "" },
		server: { text: "Less is more", source_type: "book", source_author: null, added_via: "manual" },
		row: { text: "Less is more", source_type: "book", source_author: null, tags: [] },
	},
	{
		name: "tags split and trimmed",
		fields: { text: "Hi", tags: " a, ,b " },
		server: { text: "Hi", tags: ["a", "b"], added_via: "manual" },
		row: { text: "Hi", tags: ["a", "b"], added_via: "manual" },
	},
	{ name: "no text", fields: { text: " " }, server: "refused" },
	{ name: "a bad url", fields: { text: "Hi", source_url: "nope" }, server: "refused" },
];

describe("quoteWrites.create agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = quoteWrites.create(fd);
			if (c.server === "refused") {
				expect(() => createQuoteForm.parse(fd)).toThrow();
				expect(w.intent).toMatchObject({ type: "patch", patch: {} });
			} else {
				expect(createQuoteForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.row });
			}
			await w.call(ctx);
			expect(createQuoteAction).toHaveBeenCalledWith(fd);
		});
	}
});

describe("quoteWrites", () => {
	it("a delete names the same quote", async () => {
		const w = quoteWrites.remove("q1");
		expect(w.intent).toEqual({ type: "delete", id: "q1" });
		await w.call(ctx);
		expect(deleteQuoteAction).toHaveBeenCalledWith("q1");
	});
});
