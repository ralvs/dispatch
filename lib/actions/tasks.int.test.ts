import { describe, expect, it, vi } from "vitest";
import { shiftDay } from "@/lib/dates";
import { todayForRequest } from "@/lib/services/settings";
import { completeTask, createTask, getTask } from "@/lib/services/tasks";
import { ownerClient } from "@/test/integration/clients";
import { completeTaskAction, skipTaskAction } from "./tasks";

// The guard reads cookies and the invalidation needs a Next request scope;
// neither exists here. Everything between them runs for real.
vi.mock("@/lib/auth", () => ({
	requireOwnerPage: async () => ({ sb: await ownerClient() }),
}));
vi.mock("@/lib/invalidate", () => ({ afterMutation: vi.fn() }));

// docs/adr/0077: a tick or a skip dates the next cycle from the day the client
// applied its intent with, checked against the server's own today (acceptedDay:
// today or the day before).
describe("task tick day against the local database", () => {
	it("a tick named for yesterday dates the next cycle from yesterday", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const yesterday = shiftDay(today, -1);
		const due = shiftDay(today, -7);
		const twin = await createTask(sb, { title: "Twin", due_date: due, recurrence_rule: "weekly" });
		const expected = await completeTask(sb, twin.id, yesterday, { dueDate: due });
		const task = await createTask(sb, {
			title: "Weekly",
			due_date: due,
			recurrence_rule: "weekly",
		});

		const result = await completeTaskAction({
			id: task.id,
			observedDueDate: due,
			todayIso: yesterday,
		});

		expect(result.ok).toBe(true);
		expect((await getTask(sb, task.id))?.due_date).toBe(expected.nextDue);
	});

	it("a tick named for today goes through", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const task = await createTask(sb, { title: "One-off", due_date: today });

		const result = await completeTaskAction({
			id: task.id,
			observedDueDate: today,
			todayIso: today,
		});

		expect(result.ok).toBe(true);
		expect((await getTask(sb, task.id))?.status).toBe("done");
	});

	it.each([
		["tomorrow", 1],
		["two days back", -2],
	])("a tick named for %s throws and writes nothing", async (_label, offset) => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const task = await createTask(sb, { title: "Held", due_date: today });

		await expect(
			completeTaskAction({
				id: task.id,
				observedDueDate: today,
				todayIso: shiftDay(today, offset),
			}),
		).rejects.toThrow("outside the accepted window");
		expect((await getTask(sb, task.id))?.status).toBe("open");
	});

	it("a skip with a day that is not a date throws and writes nothing", async () => {
		const sb = await ownerClient();
		const today = await todayForRequest(sb);
		const task = await createTask(sb, {
			title: "Skipped",
			due_date: today,
			recurrence_rule: "weekly",
		});

		await expect(
			skipTaskAction({ id: task.id, observedDueDate: today, todayIso: "not-a-day" }),
		).rejects.toThrow("outside the accepted window");
		expect((await getTask(sb, task.id))?.due_date).toBe(today);
	});
});
