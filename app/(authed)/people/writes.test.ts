import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPersonForm } from "@/lib/schemas/person";
import type { IntentCtx } from "@/lib/store/types";
import { createPersonAction } from "./actions";
import { personListWrites } from "./writes";

vi.mock("./actions", () => ({ createPersonAction: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

function form(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
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
		name: "a name, a relationship, a blank email",
		fields: { name: " Ana ", relationship_type: "friend", email: "" },
		server: { name: "Ana", relationship_type: "friend", email: null },
		row: { name: "Ana", relationship_type: "friend", email: null, phone: null, notes: null },
	},
	{
		name: "no relationship picked",
		fields: { name: "Ana", relationship_type: "" },
		server: { name: "Ana", relationship_type: null },
		row: { name: "Ana", relationship_type: null },
	},
	{ name: "no name", fields: { name: " " }, server: "refused" },
	{
		name: "a bad relationship",
		fields: { name: "Ana", relationship_type: "nope" },
		server: "refused",
	},
];

describe("personListWrites.create agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = personListWrites.create(fd);
			if (c.server === "refused") {
				expect(() => createPersonForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: expect.any(String), patch: {} });
			} else {
				expect(createPersonForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.row });
			}
			await w.call(ctx);
			expect(createPersonAction).toHaveBeenCalledWith(fd);
		});
	}
});
