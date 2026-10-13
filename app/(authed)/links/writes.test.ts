import { describe, expect, it, vi } from "vitest";
import type { IntentCtx } from "@/lib/store/types";
import { setLinkStatusAction } from "./actions";
import { linkWrites } from "./writes";

vi.mock("./actions", () => ({ setLinkStatusAction: vi.fn() }));

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("linkWrites.setStatus", () => {
	it("the intent and the call name the same link and status", async () => {
		const w = linkWrites.setStatus("l1", "dismissed");
		expect(w.intent).toEqual({ type: "patch", id: "l1", patch: { status: "dismissed" } });
		await w.call(ctx);
		expect(setLinkStatusAction).toHaveBeenCalledWith("l1", "dismissed");
	});
});
