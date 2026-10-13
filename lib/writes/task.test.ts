import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	completeTaskAction,
	createTaskAction,
	setTop3Action,
	skipTaskAction,
} from "@/lib/actions/tasks";
import { taskForm, taskFormFields } from "@/lib/schemas/task";
import type { IntentCtx } from "@/lib/store/types";
import { taskWrites } from "./task";

vi.mock("@/lib/actions/tasks", () => ({
	assignDomainAction: vi.fn(),
	completeTaskAction: vi.fn(),
	createTaskAction: vi.fn(),
	deleteTaskAction: vi.fn(),
	quickAddTaskAction: vi.fn(),
	reopenTaskAction: vi.fn(),
	setTop3Action: vi.fn(),
	skipTaskAction: vi.fn(),
	updateTaskAction: vi.fn(),
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// A tab that slept past midnight: the store applied the intent with yesterday.
const ctx: IntentCtx = {
	todayIso: "2026-07-14",
	tz: "America/Sao_Paulo",
	nowIso: "2026-07-15T12:00:00.000Z",
};

describe("taskWrites", () => {
	it("a tick sends the day the store applied it with", async () => {
		const w = taskWrites.complete({ id: "t1", observedDueDate: "2026-07-10", snapshotId: "s1" });
		expect(w.intent).toEqual({
			type: "complete",
			id: "t1",
			observedDueDate: "2026-07-10",
			snapshotId: "s1",
		});
		await w.call(ctx);
		expect(completeTaskAction).toHaveBeenCalledWith({
			id: "t1",
			observedDueDate: "2026-07-10",
			snapshotId: "s1",
			todayIso: "2026-07-14",
		});
	});

	it("a skip sends the day the store applied it with", async () => {
		const w = taskWrites.skip({ id: "t1", observedDueDate: null });
		expect(w.intent).toEqual({ type: "skip", id: "t1", observedDueDate: null });
		await w.call(ctx);
		expect(skipTaskAction).toHaveBeenCalledWith({
			id: "t1",
			observedDueDate: null,
			todayIso: "2026-07-14",
		});
	});

	it("a star pins the intent's own day", async () => {
		const i = { id: "t1", starred: true, forDateIso: "2026-07-16" };
		const w = taskWrites.setTop3(i);
		expect(w.intent).toEqual({ type: "setTop3", ...i });
		await w.call(ctx);
		expect(setTop3Action).toHaveBeenCalledWith(i);
	});
});

const HOME = "7f1c0a4e-1111-4000-8000-000000000001";
const PROJECT = "7f1c0a4e-2222-4000-8000-000000000002";
const domains = [{ id: HOME, name: "Home", color: "#123456" }];
const projects = [{ id: PROJECT, name: "Garden" }];

function form(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(entries)) fd.set(k, v);
	return fd;
}

// One decode, two halves (docs/adr/0087): the columns the server writes are
// the columns the list shows, and a form the server refuses shows nothing.
const cases: {
	name: string;
	fields: Record<string, string>;
	server: Record<string, unknown> | "refused";
	row?: Record<string, unknown>;
}[] = [
	{
		name: "priority absent is the default",
		fields: { title: "Buy milk", domain_id: HOME },
		server: { title: "Buy milk", priority: 3, domain_id: HOME, notes: null, project_id: null },
		row: {
			title: "Buy milk",
			priority: 3,
			domain_id: HOME,
			domain: { id: HOME, name: "Home", color: "#123456" },
			project: null,
		},
	},
	{
		name: "notes are trimmed",
		fields: { title: "x", notes: "  hi ", domain_id: HOME, priority: "1" },
		server: { notes: "hi", priority: 1 },
		row: { notes: "hi", priority: 1 },
	},
	{
		name: "a project gives its join",
		fields: { title: "x", domain_id: HOME, project_id: PROJECT, due_date: "2026-07-20" },
		server: { project_id: PROJECT, due_date: "2026-07-20", due_time: null },
		row: { project_id: PROJECT, project: { id: PROJECT, name: "Garden" }, due_date: "2026-07-20" },
	},
	{ name: "no domain", fields: { title: "x", domain_id: "" }, server: "refused" },
	{
		name: "a time without a date",
		fields: { title: "x", domain_id: HOME, due_time: "09:00" },
		server: "refused",
	},
	{
		name: "a bad recurrence",
		fields: { title: "x", domain_id: HOME, recurrence_rule: "sometimes" },
		server: "refused",
	},
];

describe("taskWrites.create agrees with the server's decode", () => {
	for (const c of cases) {
		it(c.name, async () => {
			const fd = form(c.fields);
			const w = taskWrites.create(fd, { domains, projects });
			if (c.server === "refused") {
				expect(() => taskForm.parse(fd)).toThrow();
				expect(w.intent).toEqual({ type: "edit", id: expect.any(String) });
			} else {
				expect(taskFormFields(taskForm.parse(fd))).toMatchObject(c.server);
				expect(w.intent).toMatchObject({ type: "create", task: c.row });
			}
			await w.call(ctx);
			expect(createTaskAction).toHaveBeenCalledWith(fd);
		});
	}
});
