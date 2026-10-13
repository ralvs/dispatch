import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	archiveProjectAction,
	completeProjectAction,
	updateProjectAction,
} from "@/app/(authed)/projects/[id]/actions";
import type { DomainRow } from "@/lib/schemas/domain";
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

describe("projectDetailWrites", () => {
	it("update patches the form's fields and its domain, and sends the same form", async () => {
		const f = new FormData();
		f.set("name", "Launch");
		f.set("domain_id", "work");
		f.set("status", "paused");
		const domains = [{ id: "work", name: "Work", color: "sage" }] as DomainRow[];
		const w = projectDetailWrites.update("p1", f, domains);
		expect(w.intent).toMatchObject({
			type: "patch",
			id: "p1",
			patch: {
				name: "Launch",
				domain_id: "work",
				domain: { id: "work", name: "Work", color: "sage" },
			},
		});
		expect(w.errorMessage).toBe("Couldn't save project.");
		await w.call(ctx);
		expect(updateProjectAction).toHaveBeenCalledWith("p1", f);
	});

	it("complete marks it done and calls complete on the same id", async () => {
		const w = projectDetailWrites.complete("p1");
		expect(w.intent).toMatchObject({ type: "patch", id: "p1", patch: { status: "done" } });
		expect(w.errorMessage).toBe("Couldn't update project.");
		await w.call(ctx);
		expect(completeProjectAction).toHaveBeenCalledWith("p1");
	});

	it("archive marks it archived and calls archive on the same id", async () => {
		const w = projectDetailWrites.archive("p1");
		expect(w.intent).toEqual({ type: "patch", id: "p1", patch: { status: "archived" } });
		await w.call(ctx);
		expect(archiveProjectAction).toHaveBeenCalledWith("p1");
	});
});
