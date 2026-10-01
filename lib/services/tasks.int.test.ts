import { describe, expect, it } from "vitest";
import { listDomains } from "@/lib/services/domains";
import { createPerson } from "@/lib/services/people";
import { createProject, updateProject } from "@/lib/services/projects";
import {
	assignDomain,
	completeTask,
	createTask,
	getTask,
	listInboxTasks,
	listTasks,
	setTop3,
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
		expect(first).toEqual({ applied: true, spawned: false, nextDue: null, successor: null });

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
		expect(result).toEqual({ applied: false, spawned: false, nextDue: null, successor: null });
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

type Sb = Awaited<ReturnType<typeof ownerClient>>;

async function aDomain(sb: Sb): Promise<string> {
	const [domain] = await listDomains(sb);
	if (!domain) throw new Error("the migrations seed at least one domain");
	return domain.id;
}

async function rowsTitled(sb: Sb, title: string) {
	const { data } = await sb
		.from("tasks")
		.select("id, status, due_date, due_time, recurrence_rule, top3_for_date, completed_at")
		.eq("title", title)
		.order("created_at", { ascending: true });
	return data ?? [];
}

describe("completeTask · recurring series (docs/adr/0059)", () => {
	it("closes the occurrence it landed on and spawns the next one beside it", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Weekly review",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		const result = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toMatchObject({ applied: true, spawned: true, nextDue: "2026-07-17" });

		const [closed, next] = await rowsTitled(sb, "Weekly review");
		// The closed row keeps its own due date and drops the rule, so re-ticking
		// it can never fork the series.
		expect(closed).toMatchObject({
			id: task.id,
			status: "done",
			due_date: "2026-07-10",
			recurrence_rule: null,
		});
		expect(closed.completed_at).not.toBeNull();
		expect(next).toMatchObject({
			status: "open",
			due_date: "2026-07-17",
			recurrence_rule: "weekly",
		});
	});

	it("closes a non-recurring task without spawning anything", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "One-off", due_date: "2026-07-10" });

		const result = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toMatchObject({ applied: true, spawned: false });
		expect(await rowsTitled(sb, "One-off")).toHaveLength(1);
	});

	it("carries due_time onto the spawned occurrence", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Meds",
			due_date: "2026-07-10",
			due_time: "09:00",
			recurrence_rule: "daily",
		});

		await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const next = (await rowsTitled(sb, "Meds")).find((r) => r.status === "open");
		expect(next?.due_time).toBe("09:00:00");
	});

	it("moves a star onto the spawned occurrence's due date", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Starred weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
			top3_for_date: JULY_15,
		});

		await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const next = (await rowsTitled(sb, "Starred weekly")).find((r) => r.status === "open");
		expect(next?.top3_for_date).toBe("2026-07-17");
	});

	it("spawns an unstarred occurrence when the completed one was not starred", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Plain weekly",
			due_date: "2026-07-10",
			recurrence_rule: "weekly",
		});

		await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		const next = (await rowsTitled(sb, "Plain weekly")).find((r) => r.status === "open");
		expect(next?.top3_for_date).toBeNull();
	});

	// The reason the insert is gated on the close having moved a row: a click
	// that matched nothing must not leave a duplicate occurrence behind.
	it("makes a tick against a moved occurrence a no-op", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, {
			title: "Moved weekly",
			due_date: "2026-07-17",
			recurrence_rule: "weekly",
		});

		const result = await completeTask(sb, task.id, JULY_15, { dueDate: "2026-07-10" });
		expect(result).toMatchObject({ applied: false, spawned: false });
		const rows = await rowsTitled(sb, "Moved weekly");
		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe("open");
	});

	it("spawns once when a recurring tick is replayed against the closed row", async () => {
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
	});

	it("closes an undated recurring task (is null, not = null)", async () => {
		const sb = await ownerClient();
		const task = await createTask(sb, { title: "Undated weekly", recurrence_rule: "weekly" });

		const result = await completeTask(sb, task.id, TODAY, { dueDate: null });
		expect(result).toMatchObject({ applied: true, spawned: true });
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

// Quiet tasks: undated work in a project that is not active (lib/task-predicates.ts).
describe("listTasks · excludeQuiet", () => {
	it("drops undated tasks in a quiet project and keeps everything else", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomain(sb);
		const paused = await createProject(sb, { name: "Paused", domain_id });
		await updateProject(sb, paused.id, { status: "paused" });
		const active = await createProject(sb, { name: "Active", domain_id });

		const quiet = await createTask(sb, { title: "quiet", project_id: paused.id, domain_id });
		const dated = await createTask(sb, {
			title: "dated",
			project_id: paused.id,
			domain_id,
			due_date: TODAY,
		});
		const loose = await createTask(sb, { title: "loose" });
		const busy = await createTask(sb, { title: "busy", project_id: active.id, domain_id });

		const kept = (await listTasks(sb, { status: "open", excludeQuiet: true })).map((t) => t.id);
		expect(kept.sort()).toEqual([dated.id, loose.id, busy.id].sort());

		const all = (await listTasks(sb, { status: "open" })).map((t) => t.id);
		expect(all).toContain(quiet.id);
	});

	it("returns every open task when every project is active", async () => {
		const sb = await ownerClient();
		const domain_id = await aDomain(sb);
		const active = await createProject(sb, { name: "Active", domain_id });
		await createTask(sb, { title: "busy", project_id: active.id, domain_id });
		await createTask(sb, { title: "loose" });

		expect(await listTasks(sb, { status: "open", excludeQuiet: true })).toHaveLength(2);
	});
});
