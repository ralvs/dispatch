import { describe, expect, it, vi } from "vitest";
import { shiftDay } from "@/lib/dates";
import { createRoutine, getRoutineWithHistory } from "@/lib/services/routines";
import { todayForRequest } from "@/lib/services/settings";
import { ownerClient } from "@/test/integration/clients";
import { toggleCompletionAction } from "./routines";

// The guard reads cookies and the invalidation needs a Next request scope;
// neither exists here. Everything between them runs for real.
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/invalidate", () => ({ afterMutation: vi.fn() }));

// docs/adr/0077: the toggle ticks the day the client applied its intent with,
// checked against the server's own today (acceptedDay).
describe("toggleCompletionAction against the local database", () => {
	it("a tick named for yesterday ticks yesterday, and the returned row carries it", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const yesterday = shiftDay(today, -1);
		const r = await createRoutine(sb, { name: "Stretch" });

		const result = await toggleCompletionAction(r.id, false, yesterday);

		expect(result).toMatchObject({
			ok: true,
			data: { rows: [{ id: r.id, completions: [yesterday] }] },
		});
		expect((await getRoutineWithHistory(sb, r.id, shiftDay(today, -30)))?.completions).toEqual([
			yesterday,
		]);
	});

	it("a future day throws and writes nothing", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const r = await createRoutine(sb, { name: "Read" });

		await expect(toggleCompletionAction(r.id, false, shiftDay(today, 1))).rejects.toThrow(
			"outside the 30-day window",
		);
		expect((await getRoutineWithHistory(sb, r.id, shiftDay(today, -30)))?.completions).toEqual([]);
	});
});
