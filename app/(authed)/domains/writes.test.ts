import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	archiveDomainAction,
	createDomainAction,
	markDomainShippedAction,
	updateDomainAction,
} from "@/app/(authed)/domains/actions";
import type { IntentCtx } from "@/lib/store/types";
import { domainWrites } from "./writes";

vi.mock("@/app/(authed)/domains/actions", () => ({
	archiveDomainAction: vi.fn(),
	createDomainAction: vi.fn(),
	markDomainShippedAction: vi.fn(),
	reactivateDomainAction: vi.fn(),
	updateDomainAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

const form = (entries: Record<string, string>) => {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.set(k, v);
	return f;
};

describe("domainWrites", () => {
	it("create shows the form's domain and sends the same form", async () => {
		const f = form({ name: " Health ", color: "sage" });
		const w = domainWrites.create(f);
		expect(w.intent).toMatchObject({
			type: "create",
			row: { name: "Health", color: "sage", touch: null },
		});
		await w.call(ctx);
		expect(createDomainAction).toHaveBeenCalledWith(f);
	});

	it("update patches only what the server keeps, and sends the same form", async () => {
		const f = form({ name: "Work", cadence_days: "400" });
		const w = domainWrites.update("d1", f);
		expect(w.intent).toMatchObject({ type: "patch", id: "d1", patch: { name: "Work" } });
		expect(w.intent).not.toHaveProperty("patch.cadenceDays");
		expect(w.errorMessage).toBe("Couldn't save domain.");
		await w.call(ctx);
		expect(updateDomainAction).toHaveBeenCalledWith("d1", f);
	});

	it("archive drops the touch and calls archive on the same id", async () => {
		const w = domainWrites.archive("d1");
		expect(w.intent).toEqual({
			type: "patch",
			id: "d1",
			patch: { active: false, touch: null },
		});
		expect(w.errorMessage).toBe("Couldn't update domain.");
		await w.call(ctx);
		expect(archiveDomainAction).toHaveBeenCalledWith("d1");
	});

	it("mark shipped stamps last_shipped_at and calls the action", async () => {
		const w = domainWrites.markShipped("d1");
		expect(w.intent).toMatchObject({ type: "patch", id: "d1" });
		await w.call(ctx);
		expect(markDomainShippedAction).toHaveBeenCalledWith("d1");
	});
});
