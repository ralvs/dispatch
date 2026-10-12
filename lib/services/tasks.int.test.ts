import { describe, expect, it } from "vitest";
import { isQuiet } from "@/lib/quiet";
import { listDomains } from "@/lib/services/domains";
import { createPerson } from "@/lib/services/people";
import { createProject, updateProject } from "@/lib/services/projects";
import { listQuietProjectIds } from "@/lib/services/quiet";
import {
	assignDomain,
	completeTask,
	createTask,
	deleteTask,
	getTask,
	listInboxTasks,
	listTasks,
	reopenTask,
	setTop3,
	skipTask,
	updateTask,
} from "@/lib/services/tasks";
import { anonClient, ownerClient, serviceClient } from "@/test/integration/clients";

// Real Postgres, the real migrations, RLS on (docs/adr/0063).

const TODAY = "2026-09-22";
// The day a July series is ticked — a tick lands the next occurrence after it.
const JULY_15 = "2026-07-15";

describe("tasks against the local database", () => {
	it("creates a task and completes it once", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Renew passport", due_date: TODAY });
		expect(task.status).toBe("open");

		const first = await completeTask(sb, task.id, TODAY, { dueDate: TODAY });
		expect(first).toEqual({ applied: true, nextDue: null, snapshot: null });

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

	it("reports a deleted task as not applied instead of throwing", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Gone before the tick" });
		await sb.from("tasks").delete().eq("id", task.id);

		const result = await completeTask(sb, task.id, TODAY, { dueDate: null });
		expect(result).toEqual({ applied: false, nextDue: null, snapshot: null });
	});

	it("matches a null due date with `is`, not `eq`", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Someday, maybe" });

		const result = await completeTask(sb, task.id, TODAY, { dueDate: null });
		expect(result.applied).toBe(true);
	});

	it("carries a monthly series on the 31st through February and back", async () => {
		const sb = await ownerClient();
		const rent = await createTask(sb, {
			title: "Pay rent",
			due_date: "2027-01-31",
			recurrence_rule: "monthly",
		});

		const toFeb = await completeTask(sb, rent.id, "2027-01-31", { dueDate: "2027-01-31" });
		expect(toFeb.nextDue).toBe("2027-02-28");
		expect(await getTask(sb, rent.id)).toMatchObject({
			due_date: "2027-02-28",
			recurrence_day: 31,
		});

		const toMar = await completeTask(sb, rent.id, "2027-02-28", { dueDate: "2027-02-28" });
		expect(toMar.nextDue).toBe("2027-03-31");
		expect(await getTask(sb, rent.id)).toMatchObject({
			due_date: "2027-03-31",
			recurrence_day: null,
		});
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

type Sb = Awaited<ReturnType<typeof ownerClient>>;

async function aDomain(sb: Sb): Promise<string> {
	const [domain] = await listDomains(sb);
	if (!domain) throw new Error("the migrations seed at least one domain");
	return domain.id;
}

async function rowsTitled(sb: Sb, title: string) {
	const { data } = await sb
		.from("tasks")
		.select(
			"id, status, due_date, due_time, recurrence_rule, recurrence_day, top3_for_date, completed_at, series_id, reminders_sent",
		)
		.eq("title", title)
		.order("created_at", { ascending: true });
	return data ?? [];
}

const SNAPSHOT_ID = "5a7e0000-0000-4000-8000-000000000001";

describe("completeTask · a recurring task stays one row (docs/adr/0083)", () => {
	it("saves a done snapshot of the cycle and moves the row to the next one", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Weekly review",
			notes: "Inbox zero first.",
			due_date: "2026-07-10",
			due_time: "09:00",
			recurrence_rule: "weekly",
		});
		await sb
			.from("tasks")
			.update({ reminders_sent: { "15": true } })
			.eq("id", task.id);

		const result = await completeTask(
			sb,
			task.id,
			JULY_15,
			{ dueDate: "2026-07-10" },
			{ snapshotId: SNAPSHOT_ID },
		);
		expect(result).toMatchObject({ applied: true, nextDue: "2026-07-17" });
		expect(result.snapshot).toMatchObject({
			id: SNAPSHOT_ID,
			title: "Weekly review",
			notes: "Inbox zero first.",
			status: "done",
			due_date: "2026-07-10",
			recurrence_rule: null,
			series_id: task.id,
		});
		expect(result.snapshot?.completed_at).not.toBeNull();

		// The row keeps its id, its rule and its time; its reminders start over.
		const rows = await rowsTitled(sb, "Weekly review");
		expect(rows).toHaveLength(2);
		expect(rows.find((r) => r.id === task.id)).toMatchObject({
			status: "open",
			due_date: "2026-07-17",
			due_time: "09:00:00",
			recurrence_rule: "weekly",
			series_id: null,
			reminders_sent: {},
		});
	});

	it("closes a non-recurring task and saves no snapshot", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "One-off", due_date: "2026-07-10" });

		const result = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toEqual({ applied: true, nextDue: null, snapshot: null });
		const rows = await rowsTitled(sb, "One-off");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ status: "done", series_id: null });
	});

	it("keeps the star on the snapshot and moves the row's star to its new date", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Starred weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
			top3_for_date: JULY_15,
		});

		const { snapshot } = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(snapshot?.top3_for_date).toBe(JULY_15);
		expect((await getTask(sb, task.id))?.top3_for_date).toBe("2026-07-17");
	});

	it("leaves an unstarred row unstarred", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Plain weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect((await getTask(sb, task.id))?.top3_for_date).toBeNull();
	});

	it("makes a tick against a moved cycle a no-op", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Moved weekly",
			due_date: "2026-07-17",
			recurrence_rule: "weekly",
		});

		const result = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toEqual({ applied: false, nextDue: null, snapshot: null });
		const rows = await rowsTitled(sb, "Moved weekly");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ status: "open", due_date: "2026-07-17" });
	});

	it("saves one snapshot when a tick is replayed", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Double tick",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const replay = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(replay.applied).toBe(false);
		expect(await rowsTitled(sb, "Double tick")).toHaveLength(2);
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-17");
	});

	it("ticks an undated recurring task (is null, not = null)", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Undated weekly", recurrence_rule: "weekly" });

		const result = await completeTask(sb, task.id, TODAY, { dueDate: null });
		expect(result.applied).toBe(true);
		expect(result.snapshot).toMatchObject({ due_date: null, series_id: task.id });
		expect((await getTask(sb, task.id))?.status).toBe("open");
	});

	it("derives the snapshot's mentions from its text", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const task = await createTask(sb, {
			title: "Call @Ana",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		const { snapshot } = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const { data } = await sb
			.from("mentions")
			.select("person_id")
			.eq("task_id", snapshot?.id ?? "");
		expect(data).toEqual([{ person_id: ana.id }]);
	});

	it("unlinks the snapshots when the recurring row is deleted", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Dropped series",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		const { snapshot } = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });

		await deleteTask(sb, task.id);
		expect(await getTask(sb, snapshot?.id ?? "")).toMatchObject({
			status: "done",
			series_id: null,
		});
	});
});

describe("reopenTask · un-ticking a recurring task (docs/adr/0083)", () => {
	async function tickedTwice(sb: Sb, title: string) {
		const task = await createTask(sb, {
			title,
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
			top3_for_date: "2026-07-10",
		});
		const first = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const second = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-17" });
		if (!first.snapshot || !second.snapshot) throw new Error("both ticks land");
		return { task, older: first.snapshot, latest: second.snapshot };
	}

	it("deletes the latest snapshot and moves the row back to its cycle", async () => {
		const sb = await ownerClient();
		const { task, latest } = await tickedTwice(sb, "Undo the last tick");
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-24");

		expect(await reopenTask(sb, latest.id)).toEqual({ seriesId: task.id });
		expect(await getTask(sb, latest.id)).toBeNull();
		expect(await getTask(sb, task.id)).toMatchObject({
			status: "open",
			due_date: "2026-07-17",
			top3_for_date: "2026-07-17",
			recurrence_rule: "weekly",
		});
	});

	it("reopens an older snapshot as a plain task and leaves the row alone", async () => {
		const sb = await ownerClient();
		const { task, older } = await tickedTwice(sb, "Reopen history");

		expect(await reopenTask(sb, older.id)).toEqual({ seriesId: null });
		expect(await getTask(sb, older.id)).toMatchObject({
			status: "open",
			completed_at: null,
			recurrence_rule: null,
			due_date: "2026-07-10",
		});
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-24");
	});

	it("puts back the reminders the tick reset", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Reminded weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		const sent = { "2026-07-10T09:00:00.000Z": true };
		await serviceClient().from("tasks").update({ reminders_sent: sent }).eq("id", task.id);
		const { snapshot } = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		if (!snapshot) throw new Error("tick lands");
		const read = async (id: string) =>
			(await serviceClient().from("tasks").select("reminders_sent").eq("id", id).single()).data
				?.reminders_sent;
		expect(await read(snapshot.id)).toEqual(sent);
		expect(await read(task.id)).toEqual({});

		await reopenTask(sb, snapshot.id);
		expect(await read(task.id)).toEqual(sent);
	});

	it("an older snapshot reopened as a plain task does not stop the latest un-tick", async () => {
		const sb = await ownerClient();
		const { task, older, latest } = await tickedTwice(sb, "Reopened history");
		await reopenTask(sb, older.id);
		// Moved past the latest snapshot's cycle: open history is not history.
		await updateTask(sb, older.id, { due_date: "2026-08-01" });

		expect(await reopenTask(sb, latest.id)).toEqual({ seriesId: task.id });
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-17");
	});

	it("un-ticks once when the un-tick is replayed", async () => {
		const sb = await ownerClient();
		const { task, latest, older } = await tickedTwice(sb, "Double untick");

		await reopenTask(sb, latest.id);
		// The latest snapshot is gone; a replay reopens nothing and moves nothing.
		expect(await reopenTask(sb, latest.id)).toEqual({ seriesId: null });
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-17");
		expect((await getTask(sb, older.id))?.status).toBe("done");
	});

	it("reopens a snapshot as a plain task once its series stops repeating", async () => {
		const sb = await ownerClient();
		const { task, latest } = await tickedTwice(sb, "Stopped series");
		await updateTask(sb, task.id, { recurrence_rule: null });

		expect(await reopenTask(sb, latest.id)).toEqual({ seriesId: null });
		expect((await getTask(sb, latest.id))?.status).toBe("open");
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-24");
	});

	it("reopens a plain done task as before", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Plain reopen", due_date: TODAY });
		await completeTask(sb, task.id, TODAY, { dueDate: TODAY });

		expect(await reopenTask(sb, task.id)).toEqual({ seriesId: null });
		expect(await getTask(sb, task.id)).toMatchObject({ status: "open", completed_at: null });
	});
});

describe("skipTask (docs/adr/0083)", () => {
	it("moves the row to its next cycle and saves no snapshot", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Skip a week",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
			top3_for_date: JULY_15,
		});

		const result = await skipTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toEqual({ applied: true, nextDue: "2026-07-17" });
		const rows = await rowsTitled(sb, "Skip a week");
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			status: "open",
			due_date: "2026-07-17",
			top3_for_date: "2026-07-17",
		});
	});

	it("skips once when the skip is replayed", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Double skip",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		await skipTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const replay = await skipTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(replay).toEqual({ applied: false, nextDue: null });
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-17");
	});

	it("writes nothing for a task that does not repeat", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "No cycle", due_date: "2026-07-10" });

		expect(await skipTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" })).toEqual({
			applied: false,
			nextDue: null,
		});
		expect((await getTask(sb, task.id))?.due_date).toBe("2026-07-10");
	});
});

describe("recurring task functions · RLS", () => {
	it("refuses a caller with no session", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Private series",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});
		const anon = anonClient();
		const args = {
			p_task_id: task.id,
			p_observed_due: "2026-07-10",
			p_next_due: "2026-07-17",
			p_next_recurrence_day: null,
		};

		const tick = await anon.rpc("complete_recurring_task", {
			...args,
			p_completed_at: "2026-07-15T12:00:00Z",
		});
		const skip = await anon.rpc("skip_recurring_task", args);
		const untick = await anon.rpc("untick_recurring_snapshot", { p_snapshot_id: task.id });
		for (const call of [tick, skip, untick]) expect(call.error).not.toBeNull();
		expect(await rowsTitled(sb, "Private series")).toMatchObject([
			{ status: "open", due_date: "2026-07-10" },
		]);
	});
});

describe("setTop3", () => {
	it("stars idempotently", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Star me" });

		const star = { forDateIso: TODAY, starred: true };
		expect(await setTop3(sb, task.id, star)).toEqual({ applied: true });
		expect(await setTop3(sb, task.id, star)).toEqual({ applied: true });
		expect((await getTask(sb, task.id))?.top3_for_date).toBe(TODAY);
	});

	// Unstarring while reading tomorrow must not clear today's star.
	it("leaves a star for another day alone and reports that unstar unapplied", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Starred today", top3_for_date: TODAY });

		const other = await setTop3(sb, task.id, { forDateIso: "2026-09-23", starred: false });
		expect(other).toEqual({ applied: false });
		expect((await getTask(sb, task.id))?.top3_for_date).toBe(TODAY);

		const same = await setTop3(sb, task.id, { forDateIso: TODAY, starred: false });
		expect(same).toEqual({ applied: true });
		expect((await getTask(sb, task.id))?.top3_for_date).toBeNull();
	});
});

// due_time may only be set alongside a due_date (DB check constraint). Both
// write paths coerce, so a patch that clears the date never trips it.
describe("due_time follows due_date", () => {
	it("nulls due_time when an update clears due_date, even if the patch sets a time", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Dentist", due_date: TODAY, due_time: "15:00" });

		await updateTask(sb, task.id, { due_date: null });
		expect(await getTask(sb, task.id)).toMatchObject({ due_date: null, due_time: null });

		await updateTask(sb, task.id, { due_date: null, due_time: "09:00" });
		expect(await getTask(sb, task.id)).toMatchObject({ due_date: null, due_time: null });
	});

	it("leaves due_time alone when the patch does not touch due_date", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Dentist", due_date: TODAY, due_time: "15:00" });

		await updateTask(sb, task.id, { title: "Dentist, renamed" });
		expect(await getTask(sb, task.id)).toMatchObject({
			title: "Dentist, renamed",
			due_date: TODAY,
			due_time: "15:00:00",
		});
	});

	it("keeps an explicit due_date and due_time", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Dentist" });

		await updateTask(sb, task.id, { due_date: "2026-08-01", due_time: "09:00" });
		expect(await getTask(sb, task.id)).toMatchObject({
			due_date: "2026-08-01",
			due_time: "09:00:00",
		});
	});

	it("drops a time given with no date on create, and keeps one given with a date", async () => {
		const sb = await ownerClient();
		const undated = await createTask(sb, { title: "ligar pro dentista", due_time: "15:00" });
		expect(undated.due_time).toBeNull();

		const dated = await createTask(sb, {
			title: "ligar pro dentista",
			due_date: "2026-08-01",
			due_time: "15:00",
		});
		expect(dated).toMatchObject({ due_date: "2026-08-01", due_time: "15:00:00" });
	});
});

// The inbox queue (docs/adr/0024, docs/adr/0027).
describe("unfiled tasks and the inbox", () => {
	it("leaves a task with no stated domain unfiled, and files it later", async () => {
		const sb = await ownerClient();
		const domainId = await aDomain(sb);
		const task = await createTask(sb, { title: "comprar café" });
		expect(task.domain_id).toBeNull();
		expect(task.source).toBe("manual");
		expect((await listInboxTasks(sb)).map((t) => t.id)).toEqual([task.id]);

		await assignDomain(sb, task.id, domainId);
		expect((await getTask(sb, task.id))?.domain_id).toBe(domainId);
		expect(await listInboxTasks(sb)).toEqual([]);
	});

	it("keeps a stated domain, and keeps done tasks out of the inbox", async () => {
		const sb = await ownerClient();
		const domainId = await aDomain(sb);
		const filed = await createTask(sb, { title: "ship it", domain_id: domainId });
		expect(filed.domain_id).toBe(domainId);

		const done = await createTask(sb, { title: "already done" });
		await completeTask(sb, done.id, TODAY, { dueDate: null });
		expect(await listInboxTasks(sb)).toEqual([]);
	});
});

describe("createTask · mentions", () => {
	it("writes a mention row for a plain @Name in the title", async () => {
		const sb = await ownerClient();
		const ana = await createPerson(sb, { name: "Ana" });
		const task = await createTask(sb, { title: "ligar pra @Ana" });

		const { data } = await sb.from("mentions").select("person_id").eq("task_id", task.id);
		expect(data).toEqual([{ person_id: ana.id }]);
	});
});

// Quiet tasks: undated work in a project that is not active (lib/quiet.ts).
describe("listTasks · excludeQuiet", () => {
	// The SQL filter and isQuiet are two encodings of one rule; this pins them
	// together over every project status and every escape.
	it("keeps exactly the open tasks isQuiet keeps", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomain(sb);
		const tasks = [await createTask(sb, { title: "loose" })];
		for (const status of ["active", "paused", "done", "archived"] as const) {
			const project = await createProject(sb, { name: status, domain_id });
			if (status !== "active") await updateProject(sb, project.id, { status });
			tasks.push(
				await createTask(sb, { title: `${status} undated`, project_id: project.id, domain_id }),
				await createTask(sb, {
					title: `${status} dated`,
					project_id: project.id,
					domain_id,
					due_date: TODAY,
				}),
			);
		}

		const quiet = await listQuietProjectIds(sb);
		expect(quiet.size).toBe(3);
		const kept = (await listTasks(sb, { status: "open", excludeQuiet: true })).map((t) => t.id);
		const expected = tasks.filter((t) => !isQuiet(t, quiet)).map((t) => t.id);
		expect(kept.sort()).toEqual(expected.sort());
		expect(kept).toHaveLength(tasks.length - 3);
	});

	// With no quiet project the filter must be skipped: PostgREST rejects an
	// empty `not.in.()`, so building it anyway would make this call throw.
	it("returns every open task when every project is active", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomain(sb);
		const active = await createProject(sb, { name: "Active", domain_id });
		await createTask(sb, { title: "busy", project_id: active.id, domain_id });
		await createTask(sb, { title: "loose" });

		expect(await listTasks(sb, { status: "open", excludeQuiet: true })).toHaveLength(2);
	});
});

// A task in a project is filed in that project's domain, whatever the write
// said (docs/adr/0072). The database holds the rule, so every path is covered.
describe("a task's domain follows its project", () => {
	async function twoDomains(sb: Sb): Promise<[string, string]> {
		const [a, b] = await listDomains(sb);
		if (!a || !b) throw new Error("the migrations seed at least two domains");
		return [a.id, b.id];
	}

	it("a create naming another domain is filed in the project's", async () => {
		const sb = await ownerClient();
		const [home, work] = await twoDomains(sb);
		const project = await createProject(sb, { name: "Kitchen", domain_id: home });
		const task = await createTask(sb, { title: "tiles", project_id: project.id, domain_id: work });
		expect(task.domain_id).toBe(home);
	});

	it("moving a task into a project moves it into the project's domain", async () => {
		const sb = await ownerClient();
		const [home, work] = await twoDomains(sb);
		const project = await createProject(sb, { name: "Kitchen", domain_id: home });
		const task = await createTask(sb, { title: "tiles", domain_id: work });
		await updateTask(sb, task.id, { project_id: project.id, domain_id: work });
		expect((await getTask(sb, task.id))?.domain_id).toBe(home);
	});

	it("a domain alone cannot pull a task away from its project's", async () => {
		const sb = await ownerClient();
		const [home, work] = await twoDomains(sb);
		const project = await createProject(sb, { name: "Kitchen", domain_id: home });
		const task = await createTask(sb, { title: "tiles", project_id: project.id, domain_id: home });
		await assignDomain(sb, task.id, work);
		expect((await getTask(sb, task.id))?.domain_id).toBe(home);
	});

	it("leaving a project keeps the domain the write gave", async () => {
		const sb = await ownerClient();
		const [home, work] = await twoDomains(sb);
		const project = await createProject(sb, { name: "Kitchen", domain_id: home });
		const task = await createTask(sb, { title: "tiles", project_id: project.id, domain_id: home });
		await updateTask(sb, task.id, { project_id: null, domain_id: work });
		expect((await getTask(sb, task.id))?.domain_id).toBe(work);
	});

	it("a project that moves domain takes its tasks with it", async () => {
		const sb = await ownerClient();
		const [home, work] = await twoDomains(sb);
		const project = await createProject(sb, { name: "Kitchen", domain_id: home });
		const inside = await createTask(sb, {
			title: "tiles",
			project_id: project.id,
			domain_id: home,
		});
		const outside = await createTask(sb, { title: "loose", domain_id: home });
		await updateProject(sb, project.id, { domain_id: work });
		expect((await getTask(sb, inside.id))?.domain_id).toBe(work);
		expect((await getTask(sb, outside.id))?.domain_id).toBe(home);
	});
});
