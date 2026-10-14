import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { afterExternalMutation, EXTERNAL_WRITES } from "@/lib/invalidate";
import { TASK_NOTES_MAX, TASK_TITLE_MAX } from "@/lib/schemas/task";
import { syncTaskMentionsFromText } from "@/lib/services/mentions";
import { recordNotification } from "@/lib/services/notifications";
import { todayForRequest } from "@/lib/services/settings";
import {
	completeTask,
	createTask,
	getTask,
	listTasks,
	skipTask,
	type TaskRow,
	updateTask,
} from "@/lib/services/tasks";
import type { SupabaseClient } from "@/lib/supabase/types";
import { isOverdue } from "@/lib/task-predicates";
import { registerTextTool, ToolError } from "../contract";
import { resolveDomain, resolveProject, UNFILED } from "../resolve";
import { extractUrls } from "../urls";

// The owner's tasks, as an assistant sees them (docs/adr/0079): read, create,
// edit, complete, and skip a recurring task's cycle (docs/adr/0083). Deleting
// stays in the app. Projects and domains are named, not referenced by id
// (../resolve.ts).

const DateSchema = z.iso.date();

/** What list_tasks shows of a task: enough to pick one and act on it. */
function toListItem(row: TaskRow, today: string) {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		due_date: row.due_date,
		due_time: row.due_time,
		project: row.project?.name ?? null,
		domain: row.domain?.name ?? null,
		overdue: isOverdue(row, today),
	};
}

/** The full row, joins as names, plus every link written in it. */
function toDetail(row: TaskRow) {
	return {
		...row,
		project: row.project?.name ?? null,
		domain: row.domain?.name ?? null,
		urls: extractUrls(row.title, row.notes),
	};
}

/** Iron rule #6: the assistant's edit lands in the ledger with what undo needs. */
async function recordUpdate(
	sb: SupabaseClient,
	id: string,
	before: TaskRow,
	after: TaskRow,
): Promise<void> {
	const prev: Record<string, string | null> = {};
	for (const key of [
		"title",
		"notes",
		"due_date",
		"due_time",
		"project_id",
		"domain_id",
	] as const) {
		if (before[key] !== after[key]) prev[key] = before[key];
	}
	await recordNotification(sb, {
		type: "mcp.task.updated",
		title: "Assistant updated a task",
		body: after.title,
		source_ref: id,
		undo_payload: { table: "tasks", id, prev },
	});
	afterExternalMutation(...EXTERNAL_WRITES.mcpTasks);
}

/**
 * The due date the assistant last read, for the precondition a tick and a skip
 * share (docs/adr/0037): a retried call finds the task moved on and writes
 * nothing, so it never ticks the next cycle by mistake.
 */
const ObservedDueSchema = DateSchema.nullable().describe(
	"The task's due_date as you last read it (null if it had none). If the task has moved on since, nothing changes.",
);

/** Why a tick or a skip wrote nothing, read from the row as it is now. */
function refusal(row: TaskRow, observed: string | null): ToolError {
	if (row.status !== "open") return new ToolError("That task is already done.");
	if (row.due_date !== observed) {
		return new ToolError(
			`That task is now due ${row.due_date ?? "with no date"}, not ${observed ?? "with no date"}. Read it again before acting.`,
		);
	}
	return new ToolError("Nothing changed.");
}

async function mustGetTask(sb: SupabaseClient, id: string): Promise<TaskRow> {
	const row = await getTask(sb, id);
	if (!row) throw new ToolError("No task with that id.");
	return row;
}

export function registerTaskTools(server: McpServer, sb: SupabaseClient): void {
	registerTextTool(
		server,
		"list_tasks",
		{
			title: "List tasks",
			description:
				'The owner\'s tasks, soonest due first. Filter by project or domain (name or id; domain "inbox" means unfiled), status, overdue, or a due-before date.',
			inputSchema: z.object({
				project: z.string().min(1).optional().describe("Project name or id."),
				domain: z.string().min(1).optional().describe('Domain name or id, or "inbox".'),
				status: z.enum(["open", "done", "all"]).default("open"),
				overdue: z.boolean().optional().describe("Only open tasks due before today."),
				due_before: DateSchema.optional().describe("Only tasks due before this YYYY-MM-DD."),
				limit: z.number().int().min(1).max(200).default(50).describe("At most this many tasks."),
			}),
			annotations: { readOnlyHint: true },
		},
		async ({ project, domain, status, overdue, due_before, limit }) => {
			const today = await todayForRequest(sb);
			const projectId = project ? (await resolveProject(sb, project)).id : undefined;
			const resolved = domain ? await resolveDomain(sb, domain) : undefined;
			let dueBefore = due_before;
			if (overdue && (!dueBefore || today < dueBefore)) dueBefore = today;
			const rows = await listTasks(sb, {
				status: overdue ? "open" : status === "all" ? undefined : status,
				projectId,
				domainId: resolved && resolved !== UNFILED ? resolved.id : undefined,
				unfiled: resolved === UNFILED,
				dueBefore,
				limit,
			});
			return rows.map((row) => toListItem(row, today));
		},
	);

	registerTextTool(
		server,
		"get_task",
		{
			title: "Get a task",
			description: "One task in full, by its id from list_tasks, with the links in its text.",
			inputSchema: z.object({ id: z.uuid().describe("The task's id.") }),
			annotations: { readOnlyHint: true },
		},
		async ({ id }) => toDetail(await mustGetTask(sb, id)),
	);

	registerTextTool(
		server,
		"create_task",
		{
			title: "Create a task",
			description:
				"Add a task. With a project it is filed in that project's domain; without one it lands in the inbox.",
			inputSchema: z.object({
				title: z.string().trim().min(1).max(TASK_TITLE_MAX),
				project: z.string().min(1).optional().describe("Project name or id."),
				due_date: DateSchema.optional().describe("YYYY-MM-DD."),
				note: z.string().max(TASK_NOTES_MAX).optional(),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ title, project, due_date, note }) => {
			const projectId = project ? (await resolveProject(sb, project)).id : null;
			const created = await createTask(sb, {
				title,
				notes: note ?? null,
				due_date: due_date ?? null,
				project_id: projectId,
				source: "manual",
			});
			// Iron rule #6: the assistant's write lands in the ledger, and so pushes.
			await recordNotification(sb, {
				type: "mcp.task.created",
				title: "Assistant created a task",
				body: created.title,
				source_ref: created.id,
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpTasks);
			return toDetail(await mustGetTask(sb, created.id));
		},
	);

	registerTextTool(
		server,
		"update_task",
		{
			title: "Update a task",
			description:
				"Edit a task by id. null clears due_date or project. note_append adds a line (dated YYYY-MM-DD unless dated is false); note_replace overwrites the notes. Not both.",
			inputSchema: z.object({
				id: z.uuid().describe("The task's id."),
				title: z.string().trim().min(1).max(TASK_TITLE_MAX).optional(),
				due_date: DateSchema.nullable().optional().describe("YYYY-MM-DD, or null to clear."),
				project: z.string().min(1).nullable().optional().describe("Name or id, or null."),
				note_append: z
					.string()
					.min(1)
					.max(TASK_NOTES_MAX)
					.optional()
					.describe("One line added to the notes."),
				note_replace: z.string().max(TASK_NOTES_MAX).optional().describe("The whole notes."),
				dated: z.boolean().default(true).describe("Prefix an appended line with today's date."),
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
		},
		async ({ id, title, due_date, project, note_append, note_replace, dated }) => {
			if (note_append !== undefined && note_replace !== undefined) {
				throw new ToolError("Send note_append or note_replace, not both.");
			}
			const patch: Parameters<typeof updateTask>[2] = {};
			if (title !== undefined) patch.title = title;
			if (due_date !== undefined) patch.due_date = due_date;
			if (project !== undefined) {
				patch.project_id = project === null ? null : (await resolveProject(sb, project)).id;
			}
			if (note_replace !== undefined) patch.notes = note_replace;
			if (Object.keys(patch).length === 0 && note_append === undefined) {
				throw new ToolError("Nothing to change: send at least one field.");
			}

			// The previous values are what the ledger's undo replays.
			const before = await mustGetTask(sb, id);
			let appended = false;
			let after: TaskRow = before;

			try {
				if (note_append !== undefined) {
					const line = dated ? `${await todayForRequest(sb)} — ${note_append}` : note_append;
					// One UPDATE, so two appends at once both survive, and it hands back
					// the notes it replaced, so the undo snapshot cannot race (the migration).
					const { data, error } = await sb.rpc("task_notes_append", {
						p_task_id: id,
						p_line: line,
						p_max: TASK_NOTES_MAX,
					});
					if (error) {
						console.error("task_notes_append failed", error);
						throw new ToolError("Could not append to the task note.");
					}
					const row = (data as { old_notes: string | null; new_notes: string }[] | null)?.[0];
					if (!row) {
						await mustGetTask(sb, id);
						throw new ToolError(`Note would exceed ${TASK_NOTES_MAX} characters.`);
					}
					appended = true;
					before.notes = row.old_notes;
				}

				// updateTask re-derives mentions when the title or notes move; an
				// append without them moves the notes outside it, so sync here only then.
				if (Object.keys(patch).length > 0) await updateTask(sb, id, patch);
				after = await mustGetTask(sb, id);
				if (note_append !== undefined && !("title" in patch)) {
					await syncTaskMentionsFromText(sb, id, after.title, after.notes);
				}
			} catch (err) {
				// The append landed but a later write failed: the ledger still owes
				// the owner a row for the append, then the error goes on.
				if (appended) {
					after = (await getTask(sb, id)) ?? after;
					await recordUpdate(sb, id, before, after);
				}
				throw err;
			}

			await recordUpdate(sb, id, before, after);
			return toDetail(after);
		},
	);

	registerTextTool(
		server,
		"complete_task",
		{
			title: "Complete a task",
			description:
				"Mark a task done, by id. A recurring task stays one task: this cycle is saved as a done copy (`done`) and the task moves to its next due date (`task`).",
			inputSchema: z.object({
				id: z.uuid().describe("The task's id."),
				due_date: ObservedDueSchema,
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
		},
		async ({ id, due_date }) => {
			const today = await todayForRequest(sb);
			const result = await completeTask(sb, id, today, { dueDate: due_date });
			const after = await mustGetTask(sb, id);
			if (!result.applied) throw refusal(after, due_date);
			// Iron rule #6. The done copy is what the owner would undo, so it is
			// the ledger's reference for a recurring tick.
			await recordNotification(sb, {
				type: "mcp.task.completed",
				title: "Assistant completed a task",
				body: after.title,
				source_ref: result.snapshot?.id ?? id,
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpTasks);
			return {
				task: toDetail(after),
				done: result.snapshot ? toDetail(result.snapshot) : null,
			};
		},
	);

	registerTextTool(
		server,
		"skip_task",
		{
			title: "Skip a recurring task's cycle",
			description:
				"Move a recurring task to its next due date without marking this cycle done. Only for a task with a recurrence rule.",
			inputSchema: z.object({
				id: z.uuid().describe("The task's id."),
				due_date: ObservedDueSchema,
			}),
			annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
		},
		async ({ id, due_date }) => {
			const before = await mustGetTask(sb, id);
			if (before.recurrence_rule === null) {
				throw new ToolError("That task does not repeat, so it has no cycle to skip.");
			}
			const today = await todayForRequest(sb);
			const result = await skipTask(sb, id, today, { dueDate: due_date });
			const after = await mustGetTask(sb, id);
			if (!result.applied) throw refusal(after, due_date);
			await recordNotification(sb, {
				type: "mcp.task.skipped",
				title: "Assistant skipped a task's cycle",
				body: after.title,
				source_ref: id,
				undo_payload: {
					table: "tasks",
					id,
					prev: {
						due_date: before.due_date,
						due_time: before.due_time,
						recurrence_day: before.recurrence_day,
						top3_for_date: before.top3_for_date,
					},
				},
			});
			afterExternalMutation(...EXTERNAL_WRITES.mcpTasks);
			return toDetail(after);
		},
	);
}
