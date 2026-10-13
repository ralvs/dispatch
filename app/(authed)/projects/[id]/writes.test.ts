import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	archiveProjectAction,
	completeProjectAction,
	updateProjectAction,
} from "@/app/(authed)/projects/[id]/actions";
import type { DomainRow } from "@/lib/schemas/domain";
import { updateProjectForm } from "@/lib/schemas/project";
import type { IntentCtx } from "@/lib/store/types";
import { projectDetailWrites } from "./writes";

vi.mock("@/app/(authed)/projects/[id]/actions", () => ({
	archiveProjectAction: vi.fn(),
	completeProjectAction: vi.fn(),
	updateProjectAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

const WORK = "7f1c0a4e-1111-4000-8000-000000000001";
const domains = [{ id: WORK, name: "Work", color: "sage" }] as DomainRow[];

function form(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return fd;
}

// One decode, two halves (docs/adr/0087): the patch the page shows is what the
// server writes, and a form the server refuses shows nothing.
const cases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	patch?: Record<string, unknown>;
}[] = [
	{
		name: "fields, a status and the domain's join",
		fields: { name: "Launch", domain_id: WORK, status: "paused", description: "" },
		server: { name: "Launch", domain_id: WORK, status: "paused", description: null },
		patch: {
			name: "Launch",
			domain_id: WORK,
			status: "paused",
			description: null,
			domain: { id: WORK, name: "Work", color: "sage" },
		},
	},
	{
		name: "a field the form did not render is left alone",
		fields: { target_date: "2026-08-01" },
		server: { target_date: "2026-08-01" },
		patch: { target_date: "2026-08-01" },
	},
	{ name: "a bad date", fields: { start_date: "soon" }, server: "refused" },
	{ name: "a bad status", fields: { status: "gone" }, server: "refused" },
];

describe("projectDetailWrites.update agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = projectDetailWrites.update("p1", fd, domains);
			if (c.server === "refused") {
				expect(() => updateProjectForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "patch", id: "p1", patch: {} });
			} else {
				expect(updateProjectForm.parse(fd)).toEqual(c.server);
				expect(w.intent).toEqual({ type: "patch", id: "p1", patch: c.patch });
			}
			expect(w.errorMessage).toBe("Couldn't save project.");
			await w.call(ctx);
			expect(updateProjectAction).toHaveBeenCalledWith("p1", fd);
		});
	}
});

describe("projectDetailWrites", () => {
	it("complete marks it done and calls complete on the same id", async () => {
		const w = projectDetailWrites.complete("p1");
		expect(w.intent).toMatchObject({
			type: "patch",
			id: "p1",
			patch: { status: "done", completed_at: expect.any(String) },
		});
		expect(w.errorMessage).toBe("Couldn't update project.");
		await w.call(ctx);
		expect(completeProjectAction).toHaveBeenCalledWith("p1");
	});

	it("archive marks it archived and calls archive on the same id", async () => {
		const w = projectDetailWrites.archive("p1");
		expect(w.intent).toEqual({ type: "patch", id: "p1", patch: { status: "archived" } });
		expect(w.errorMessage).toBe("Couldn't update project.");
		await w.call(ctx);
		expect(archiveProjectAction).toHaveBeenCalledWith("p1");
	});
});
