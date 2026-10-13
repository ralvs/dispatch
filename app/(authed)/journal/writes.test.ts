import { beforeEach, describe, expect, it, vi } from "vitest";
import { createJournalEntryForm } from "@/lib/schemas/journal";
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

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

// One decode, two halves (docs/adr/0087): the dated form the server parses is
// what the list shows, and a form the server refuses shows nothing.
const cases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	row?: Record<string, unknown>;
}[] = [
	{
		name: "a blank date is the page's today",
		fields: { transcription_text: "Dia bom", tags: "a, b," },
		server: { entry_date: "2026-07-15", transcription_text: "Dia bom", tags: ["a", "b"] },
		row: { entry_date: "2026-07-15", transcription_text: "Dia bom", tags: ["a", "b"] },
	},
	{
		name: "a picked date",
		fields: { entry_date: "2026-07-01", transcription_text: "Ontem" },
		server: { entry_date: "2026-07-01", transcription_text: "Ontem" },
		row: { entry_date: "2026-07-01", transcription_text: "Ontem", tags: [] },
	},
	{ name: "no text", fields: { entry_date: "2026-07-01" }, server: "refused" },
	{
		name: "a bad date",
		fields: { entry_date: "soon", transcription_text: "x" },
		server: "refused",
	},
];

describe("journalWrites.create agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const w = journalWrites.create(form(c.fields), "2026-07-15");
			await w.call(ctx);
			const sent = vi.mocked(createEntryAction).mock.calls[0][0];
			if (c.server === "refused") {
				expect(() => createJournalEntryForm.parse(sent)).toThrow();
				expect(w.intent).toMatchObject({ type: "patch", patch: {} });
			} else {
				expect(createJournalEntryForm.parse(sent)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.row });
			}
		});
	}
});

describe("journalWrites", () => {
	it("a blank date is sent dated; the caller's form is untouched", async () => {
		const fd = form({ transcription_text: "Dia bom" });
		await journalWrites.create(fd, "2026-07-15").call(ctx);
		const sent = vi.mocked(createEntryAction).mock.calls[0][0];
		expect(sent.get("entry_date")).toBe("2026-07-15");
		expect(fd.get("entry_date")).toBeNull();
	});

	it("a picked date goes to the server as is", async () => {
		const fd = form({ entry_date: "2026-07-01", transcription_text: "x" });
		await journalWrites.create(fd, "2026-07-15").call(ctx);
		expect(createEntryAction).toHaveBeenCalledWith(fd);
	});

	it("a delete names the same entry", async () => {
		const w = journalWrites.remove("e1");
		expect(w.intent).toEqual({ type: "delete", id: "e1" });
		await w.call(ctx);
		expect(deleteEntryAction).toHaveBeenCalledWith("e1");
	});
});
