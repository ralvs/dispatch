import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainRow } from "@/lib/schemas/domain";
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

const domains = [{ id: "work", name: "Work", color: "sage" }] as DomainRow[];

function form(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return fd;
}

describe("projectWrites.create", () => {
	it("shows the project under its domain and sends the same form", async () => {
		const fd = form({
			name: " Launch ",
			domain_id: "work",
			start_date: "2026-07-01",
			target_date: "soon",
		});
		const w = projectWrites.create(fd, domains);
		expect(w.intent).toMatchObject({
			type: "create",
			row: {
				name: "Launch",
				status: "active",
				domain_id: "work",
				domain: { id: "work", name: "Work", color: "sage" },
				start_date: "2026-07-01",
				target_date: null,
			},
		});
		await w.call(ctx);
		expect(createProjectAction).toHaveBeenCalledWith(fd);
	});

	it("an unknown or missing domain leaves the row without one", () => {
		for (const fd of [form({ name: "A", domain_id: "gone" }), form({ name: "B" })]) {
			const w = projectWrites.create(fd, domains);
			if (w.intent.type !== "create") throw new Error("expected a create");
			expect(w.intent.row.domain_id).toBe("");
			expect(w.intent.row).not.toHaveProperty("domain");
		}
	});
});
