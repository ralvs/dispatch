import { describe, expect, it, vi } from "vitest";

// Cache invalidation needs a Next request scope; there is none in a test.
vi.mock("@/lib/invalidate", async (original) => ({
	...(await original<typeof import("@/lib/invalidate")>()),
	afterExternalMutation: vi.fn(),
}));

import { POST } from "@/app/api/mcp/route";
import { shiftDay } from "@/lib/dates";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { listDomains } from "@/lib/services/domains";
import { createProject } from "@/lib/services/projects";
import { todayForRequest } from "@/lib/services/settings";
import { createTask } from "@/lib/services/tasks";
import { ownerClient, serviceClient } from "@/test/integration/clients";

// The task tools through POST /api/mcp, as the owner, against the local
// database (docs/adr/0079).

let nextId = 1;
async function call(name: string, args: unknown) {
	const { data } = await (await ownerClient()).auth.getSession();
	if (!data.session) throw new Error("owner has no session");
	const res = await POST(
		new Request("http://localhost/api/mcp", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${data.session.access_token}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: nextId++,
				method: "tools/call",
				params: { name, arguments: args },
			}),
		}),
	);
	expect(res.status).toBe(200);
	const body = await res.text();
	const line = res.headers.get("content-type")?.includes("text/event-stream")
		? (body.split("\n").find((l) => l.startsWith("data: ")) ?? "").slice("data: ".length)
		: body;
	const result = JSON.parse(line).result as { content: { text: string }[]; isError?: boolean };
	return {
		isError: Boolean(result.isError),
		text: result.content[0].text,
		json: () => JSON.parse(result.content[0].text),
	};
}

async function seed() {
	const sb = await ownerClient();
	const [domainA, domainB] = await listDomains(sb);
	const project = await createProject(sb, { name: "Garden Shed", domain_id: domainB.id });
	const today = await todayForRequest(sb);
	const late = await createTask(sb, {
		title: "Late",
		due_date: shiftDay(today, -2),
		domain_id: domainA.id,
	});
	const soon = await createTask(sb, {
		title: "Soon",
		due_date: shiftDay(today, 3),
		project_id: project.id,
	});
	const loose = await createTask(sb, { title: "Loose" });
	const done = await createTask(sb, { title: "Done one", domain_id: domainA.id });
	await serviceClient().from("tasks").update({ status: "done" }).eq("id", done.id);
	return { sb, domainA, domainB, project, today, late, soon, loose, done };
}

async function ledger(type: string) {
	const { data } = await serviceClient()
		.from("notifications")
		.select("type, source_ref, undo_payload")
		.eq("type", type);
	return data ?? [];
}

const titles = (rows: { title: string }[]) => rows.map((r) => r.title).sort();

describe("MCP task tools", () => {
	it("list_tasks filters by project, domain, inbox, overdue, due_before, status and limit", async () => {
		const s = await seed();
		expect(titles((await call("list_tasks", { project: "garden shed" })).json())).toEqual(["Soon"]);
		expect(titles((await call("list_tasks", { domain: s.domainA.name })).json())).toEqual(["Late"]);
		expect(titles((await call("list_tasks", { domain: "inbox" })).json())).toEqual(["Loose"]);
		const overdue = (await call("list_tasks", { overdue: true })).json();
		expect(overdue).toEqual([
			expect.objectContaining({ title: "Late", overdue: true, domain: s.domainA.name }),
		]);
		expect(
			titles((await call("list_tasks", { due_before: shiftDay(s.today, 10) })).json()),
		).toEqual(["Late", "Soon"]);
		expect(titles((await call("list_tasks", { status: "done" })).json())).toEqual(["Done one"]);
		expect((await call("list_tasks", { status: "all" })).json()).toHaveLength(4);
		expect((await call("list_tasks", { limit: 1 })).json()).toHaveLength(1);

		const unknown = await call("list_tasks", { project: "Nope" });
		expect(unknown.isError).toBe(true);
		expect(unknown.text).toContain("Garden Shed");
	});

	it("create_task in a project lands in its domain and writes a ledger row", async () => {
		const s = await seed();
		const result = await call("create_task", {
			title: "Paint door",
			project: "Garden Shed",
			note: "see https://example.com/paint.",
		});
		expect(result.isError).toBe(false);
		const task = result.json();
		expect(task).toMatchObject({
			title: "Paint door",
			project: "Garden Shed",
			domain: s.domainB.name,
			urls: ["https://example.com/paint"],
		});
		expect(await ledger("mcp.task.created")).toEqual([
			{ type: "mcp.task.created", source_ref: task.id, undo_payload: null },
		]);
		expect(afterExternalMutation).toHaveBeenCalledWith(...EXTERNAL_WRITES.mcpTasks);

		const inbox = (await call("create_task", { title: "No home" })).json();
		expect(inbox).toMatchObject({ project: null, domain: null, domain_id: null });
	});

	it("get_task returns the row with its urls, and names a missing id", async () => {
		const { sb } = await seed();
		const t = await createTask(sb, { title: "Read http://a.io/x", notes: "and https://b.io/y" });
		expect((await call("get_task", { id: t.id })).json().urls).toEqual([
			"http://a.io/x",
			"https://b.io/y",
		]);
		const missing = await call("get_task", { id: "00000000-0000-4000-8000-000000000000" });
		expect(missing).toMatchObject({ isError: true, text: "No task with that id." });
	});

	it("update_task appends dated lines atomically and refuses past the cap", async () => {
		const { sb, today } = await seed();
		const t = await createTask(sb, { title: "Log", notes: "start" });
		const [a, b] = await Promise.all([
			call("update_task", { id: t.id, note_append: "one" }),
			call("update_task", { id: t.id, note_append: "two", dated: false }),
		]);
		expect(a.isError || b.isError).toBe(false);
		const notes: string = (await call("get_task", { id: t.id })).json().notes;
		expect(notes.split("\n").sort()).toEqual([`${today} — one`, "start", "two"].sort());

		const tooLong = await call("update_task", { id: t.id, note_append: "x".repeat(4990) });
		expect(tooLong).toMatchObject({ isError: true, text: "Note would exceed 5000 characters." });

		const both = await call("update_task", { id: t.id, note_append: "a", note_replace: "b" });
		expect(both.isError).toBe(true);
		const none = await call("update_task", { id: t.id });
		expect(none.isError).toBe(true);
		const missing = await call("update_task", {
			id: "00000000-0000-4000-8000-000000000000",
			note_append: "x",
		});
		expect(missing).toMatchObject({ isError: true, text: "No task with that id." });
		expect(await ledger("mcp.task.updated")).toHaveLength(2);
	});

	it("update_task replace keeps the previous values in the undo payload", async () => {
		const { sb } = await seed();
		const t = await createTask(sb, { title: "Old", notes: "old notes", due_date: "2026-01-02" });
		const result = await call("update_task", {
			id: t.id,
			title: "New",
			note_replace: "new notes",
			due_date: null,
		});
		expect(result.json()).toMatchObject({ title: "New", notes: "new notes", due_date: null });
		expect(await ledger("mcp.task.updated")).toEqual([
			{
				type: "mcp.task.updated",
				source_ref: t.id,
				undo_payload: {
					table: "tasks",
					id: t.id,
					prev: { title: "Old", notes: "old notes", due_date: "2026-01-02" },
				},
			},
		]);
	});
});
