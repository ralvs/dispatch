import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainRow } from "@/lib/schemas/domain";
import { createProjectForm } from "@/lib/schemas/project";
import type { IntentCtx } from "@/lib/store/types";
import { createProjectAction } from "./actions";
import { projectWrites } from "./writes";

vi.mock("./actions", () => ({ createProjectAction: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

const WORK = "7f1c0a4e-1111-4000-8000-000000000001";
const GONE = "7f1c0a4e-9999-4000-8000-000000000009";
const domains = [{ id: WORK, name: "Work", color: "sage" }] as DomainRow[];

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
		name: "a project under its domain",
		fields: { name: " Launch ", domain_id: WORK, start_date: "2026-07-01", target_date: "" },
		server: { name: "Launch", domain_id: WORK, start_date: "2026-07-01", target_date: null },
		row: {
			name: "Launch",
			status: "active",
			domain_id: WORK,
			domain: { id: WORK, name: "Work", color: "sage" },
			start_date: "2026-07-01",
			target_date: null,
		},
	},
	{
		name: "a domain the page does not hold: no join",
		fields: { name: "A", domain_id: GONE },
		server: { name: "A", domain_id: GONE },
		row: { name: "A", domain_id: GONE, description: null },
	},
	{ name: "no domain", fields: { name: "B" }, server: "refused" },
	{ name: "no name", fields: { name: " ", domain_id: WORK }, server: "refused" },
	{
		name: "a bad date",
		fields: { name: "C", domain_id: WORK, target_date: "soon" },
		server: "refused",
	},
];

describe("projectWrites.create agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = projectWrites.create(fd, domains);
			if (c.server === "refused") {
				expect(() => createProjectForm.parse(fd)).toThrow();
				expect(w.intent).toMatchObject({ type: "patch", patch: {} });
			} else {
				expect(createProjectForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toMatchObject({ type: "create", row: c.row });
				if (c.fields.domain_id === GONE) expect(w.intent).not.toHaveProperty("row.domain");
			}
			await w.call(ctx);
			expect(createProjectAction).toHaveBeenCalledWith(fd);
		});
	}
});
