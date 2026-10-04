import { beforeEach, describe, expect, it, vi } from "vitest";
import { toggleCompletionAction } from "@/lib/actions/routines";
import type { IntentCtx } from "@/lib/store/types";
import { routineWrites } from "./routine";

vi.mock("@/lib/actions/routines", () => ({
	archiveRoutineAction: vi.fn(),
	createRoutineAction: vi.fn(),
	deleteRoutineAction: vi.fn(),
	toggleCompletionAction: vi.fn(),
	updateRoutineAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

const ctx: IntentCtx = {
	todayIso: "2026-07-15",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("routineWrites.toggle", () => {
	it("the intent and the call name the same day, whatever the clock says", async () => {
		const w = routineWrites.toggle({ id: "r1", date: "2026-07-14", done: true });
		expect(w.intent).toEqual({ type: "toggle", id: "r1", date: "2026-07-14", done: true });
		await w.call(ctx);
		expect(toggleCompletionAction).toHaveBeenCalledWith("r1", false, "2026-07-14");
	});

	it("an untick sends currentlyDone = true", async () => {
		await routineWrites.toggle({ id: "r1", date: "2026-07-15", done: false }).call(ctx);
		expect(toggleCompletionAction).toHaveBeenCalledWith("r1", true, "2026-07-15");
	});
});
