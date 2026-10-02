import { describe, expect, it } from "vitest";
import { listNotifications } from "@/lib/services/notifications";
import { runTaskReminders } from "@/lib/services/reminders";
import { updateReminderSettings } from "@/lib/services/settings";
import { completeTask, createTask } from "@/lib/services/tasks";
import { serviceClient } from "@/test/integration/clients";

// The reminders cron against the real tables (#18). It runs under the service
// client, like app/api/cron/reminders/route.ts.

const TZ = "America/Sao_Paulo";
const TODAY = "2026-07-14";
const NOW_MS = Date.parse("2026-07-14T18:00:00.000Z"); // 15:00 SP

/** A timestamptz as whole microseconds — Date.parse would drop the last three digits. */
function micros(ts: string): bigint {
	const fraction = ts.match(/\.(\d+)/)?.[1] ?? "";
	const seconds = Date.parse(ts.replace(/\.\d+/, "")) / 1000;
	return BigInt(seconds) * BigInt(1_000_000) + BigInt(fraction.padEnd(6, "0").slice(0, 6));
}

/** The two columns the cron writes, which TASK_SELECT does not carry. */
async function sentState(id: string) {
	const { data, error } = await serviceClient()
		.from("tasks")
		.select("reminders_sent, updated_at")
		.eq("id", id)
		.single();
	if (error) throw error;
	return data as { reminders_sent: Record<string, string>; updated_at: string };
}

async function run(nowMs = NOW_MS) {
	return runTaskReminders(serviceClient(), { tz: TZ, todayIso: TODAY, nowMs });
}

describe("runTaskReminders against the local database", () => {
	it("fires a due reminder: one ledger row, then reminders_sent", async () => {
		const sb = serviceClient();
		const task = await createTask(sb, { title: "Pay rent", due_date: TODAY, due_time: "15:00" });

		expect(await run()).toEqual({ scanned: 1, fired: 1, suppressed: 0 });

		const [row] = await listNotifications(sb);
		expect(row).toMatchObject({
			type: "reminder.fired",
			title: "Pay rent",
			body: "Due now, at 15:00.",
			source_ref: task.id,
			source_url: `/tasks?edit=${task.id}`,
			status: "unread",
		});
		const marked = await sentState(task.id);
		expect(marked.reminders_sent).toEqual({ due: TODAY });
		// Notify, then mark (ADR-0015): the mark is the later write.
		expect(micros(marked.updated_at)).toBeGreaterThan(micros(row.created_at));
	});

	it("does not fire twice for the same due date", async () => {
		await createTask(serviceClient(), { title: "Pay rent", due_date: TODAY, due_time: "15:00" });

		await run();
		expect(await run()).toEqual({ scanned: 1, fired: 0, suppressed: 0 });
		expect(await listNotifications(serviceClient())).toHaveLength(1);
	});

	it("scans only open tasks due in [today-1, today+3]", async () => {
		const sb = serviceClient();
		await createTask(sb, { title: "Too old", due_date: "2026-07-12", due_time: "15:00" });
		await createTask(sb, { title: "Too far", due_date: "2026-07-18", due_time: "15:00" });
		await createTask(sb, { title: "No date" });
		const done = await createTask(sb, { title: "Done", due_date: TODAY, due_time: "15:00" });
		await completeTask(sb, done.id, TODAY, { dueDate: TODAY });
		await createTask(sb, { title: "Yesterday", due_date: "2026-07-13", due_time: "23:00" });
		await createTask(sb, { title: "In three days", due_date: "2026-07-17", due_time: "15:00" });

		expect((await run()).scanned).toBe(2);
	});

	it("writes nothing for a reminder that is not due yet", async () => {
		const sb = serviceClient();
		const task = await createTask(sb, { title: "Later", due_date: TODAY, due_time: "23:00" });

		expect(await run()).toEqual({ scanned: 1, fired: 0, suppressed: 0 });
		expect(await listNotifications(sb)).toEqual([]);
		expect((await sentState(task.id)).reminders_sent).toEqual({});
	});

	it("marks a reminder beyond catch-up as sent, with no notification", async () => {
		const sb = serviceClient();
		// 03:00 SP yesterday — far past the 2h catch-up window.
		const task = await createTask(sb, {
			title: "Very overdue",
			due_date: "2026-07-13",
			due_time: "00:00",
		});

		expect(await run()).toEqual({ scanned: 1, fired: 0, suppressed: 1 });
		expect(await listNotifications(sb)).toEqual([]);
		expect((await sentState(task.id)).reminders_sent).toEqual({ due: "2026-07-13" });
	});

	it("anchors a task with no time at the seeded 09:00", async () => {
		await createTask(serviceClient(), { title: "Anchor test", due_date: TODAY });

		// 08:59 SP is before the anchor; 09:00 SP is on it.
		expect((await run(Date.parse("2026-07-14T11:59:00.000Z"))).fired).toBe(0);
		expect((await run(Date.parse("2026-07-14T12:00:00.000Z"))).fired).toBe(1);
	});

	it("falls back to a zero offset and a 09:00 anchor with no settings row", async () => {
		const sb = serviceClient();
		const { error } = await sb.from("app_settings").delete().eq("id", true);
		if (error) throw error;
		await createTask(sb, { title: "Anchor test", due_date: TODAY });

		expect((await run(Date.parse("2026-07-14T11:59:00.000Z"))).fired).toBe(0);
		expect((await run(Date.parse("2026-07-14T12:00:00.000Z"))).fired).toBe(1);
		// A non-zero offset would add "— N before" to the body. Offset 0, so the
		// fire time above is the anchor itself: 09:00 in São Paulo.
		expect((await listNotifications(sb))[0]?.body).toBe("Due today.");
	});

	it("reads the offset and anchor from app_settings", async () => {
		const sb = serviceClient();
		await updateReminderSettings(sb, { offsetMinutes: 60, anchorTime: "16:00" });
		await createTask(sb, { title: "Anchor test", due_date: TODAY });

		// 16:00 SP less 60 minutes is 15:00 SP — NOW_MS.
		expect((await run(NOW_MS - 60_000)).fired).toBe(0);
		expect((await run()).fired).toBe(1);
	});
});
