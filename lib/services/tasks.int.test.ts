import { describe, expect, it } from "vitest";
import { completeTask, createTask, getTask } from "@/lib/services/tasks";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// Proves the integration layer end to end: real Postgres, the real migrations,
// RLS on. The stub-based cases in tasks.test.ts move here in #18.

const TODAY = "2026-09-22";

describe("tasks against the local database", () => {
	it("creates a task and completes it once", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Renew passport", due_date: TODAY });
		expect(task.status).toBe("open");

		const first = await completeTask(sb, task.id, TODAY, { dueDate: TODAY });
		expect(first).toEqual({ applied: true, spawned: false, nextDue: null });

		const done = await getTask(sb, task.id);
		expect(done?.status).toBe("done");
		expect(done?.completed_at).not.toBeNull();

		// A replayed close matches no open row, so it writes nothing (ADR-0037).
		const replay = await completeTask(sb, task.id, TODAY, { dueDate: TODAY });
		expect(replay.applied).toBe(false);
		expect((await getTask(sb, task.id))?.completed_at).toBe(done?.completed_at);
	});

	it("leaves a task open when it moved since the caller saw it", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Call the bank", due_date: TODAY });

		const stale = await completeTask(sb, task.id, TODAY, { dueDate: "2026-09-21" });
		expect(stale.applied).toBe(false);
		expect((await getTask(sb, task.id))?.status).toBe("open");
	});

	it("matches a null due date with `is`, not `eq`", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Someday, maybe" });

		const result = await completeTask(sb, task.id, TODAY, { dueDate: null });
		expect(result.applied).toBe(true);
	});

	it("carries a monthly series on the 31st through February and back", async () => {
		const sb = await ownerClient();
		const jan = await createTask(sb, {
			title: "Pay rent",
			due_date: "2027-01-31",
			recurrence_rule: "monthly",
		});

		const toFeb = await completeTask(sb, jan.id, "2027-01-31", { dueDate: "2027-01-31" });
		expect(toFeb.nextDue).toBe("2027-02-28");
		const feb = await sb
			.from("tasks")
			.select("id, recurrence_day")
			.eq("status", "open")
			.eq("due_date", "2027-02-28")
			.single();
		expect(feb.data?.recurrence_day).toBe(31);

		const toMar = await completeTask(sb, feb.data?.id ?? "", "2027-02-28", {
			dueDate: "2027-02-28",
		});
		expect(toMar.nextDue).toBe("2027-03-31");
		const mar = await sb
			.from("tasks")
			.select("recurrence_day")
			.eq("status", "open")
			.eq("due_date", "2027-03-31")
			.single();
		expect(mar.data?.recurrence_day).toBeNull();
	});

	it("rejects a recurrence day that can never clamp", async () => {
		const sb = await ownerClient();
		const write = await sb
			.from("tasks")
			.insert({ title: "Bad day", source: "manual", recurrence_day: 15 });
		expect(write.error?.message).toContain("tasks_recurrence_day_check");
	});

	it("runs the same service under the service-role client", async () => {
		const task = await createTask(serviceClient(), { title: "Written by cron" });

		const seen = await getTask(await ownerClient(), task.id);
		expect(seen?.title).toBe("Written by cron");
	});

	it("keeps the tasks table closed to a caller with no session", async () => {
		await createTask(await ownerClient(), { title: "Private" });
		const sb = anonClient();

		const read = await sb.from("tasks").select("id");
		expect(read.data).toEqual([]);

		const write = await sb.from("tasks").insert({ title: "Intruder", source: "manual" });
		expect(write.error).not.toBeNull();
	});
});
