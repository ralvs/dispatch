// The task kind's writes (docs/adr/0077): each builder makes the intent and
// its server call from the same arguments. Client-safe — server-action
// references only.

import {
	assignDomainAction,
	completeTaskAction,
	createTaskAction,
	deleteTaskAction,
	quickAddTaskAction,
	reopenTaskAction,
	setTop3Action,
	skipTaskAction,
	updateTaskAction,
} from "@/lib/actions/tasks";
import { type TaskRow, taskForm, taskFormFields } from "@/lib/schemas/task";
import { type Write, write } from "@/lib/store/write";
import { optimisticTaskFromFields } from "@/lib/task-interaction/optimistic-task";

type DomainOption = { id: string; name: string; color?: string | null };
type ProjectOption = { id: string; name: string };

const UPDATE_ERROR = "Couldn't update that task. Try again.";
const DELETE_ERROR = "Couldn't delete task.";
const FILE_ERROR = "Couldn't file task.";

export const taskWrites = {
	/**
	 * Tick an open task. A recurring tick dates its next cycle from the day the
	 * store applied the intent with (`ctx.todayIso`), and the server dates it
	 * from that same day (docs/adr/0077, docs/adr/0083).
	 */
	complete: (i: {
		id: string;
		observedDueDate: string | null;
		snapshotId?: string;
	}): Write<"task"> =>
		write(
			"task",
			{ type: "complete", ...i },
			(ctx) => completeTaskAction({ ...i, todayIso: ctx.todayIso }),
			UPDATE_ERROR,
		),
	/** Skip a recurring task's cycle; dated like a tick. */
	skip: (i: { id: string; observedDueDate: string | null }): Write<"task"> =>
		write(
			"task",
			{ type: "skip", ...i },
			(ctx) => skipTaskAction({ ...i, todayIso: ctx.todayIso }),
			UPDATE_ERROR,
		),
	reopen: (id: string): Write<"task"> =>
		write("task", { type: "reopen", id }, () => reopenTaskAction(id), UPDATE_ERROR),
	/** Star or unstar for one day: the day the intent pins to is the day the server pins to. */
	setTop3: (i: { id: string; starred: boolean; forDateIso: string }): Write<"task"> =>
		write("task", { type: "setTop3", ...i }, () => setTop3Action(i), UPDATE_ERROR),
	remove: (id: string): Write<"task"> =>
		write("task", { type: "delete", id }, () => deleteTaskAction(id), DELETE_ERROR),
	assign: (id: string, domainId: string): Write<"task"> =>
		write(
			"task",
			{ type: "assign", id, domainId },
			() => assignDomainAction(id, domainId),
			FILE_ERROR,
		),
	/**
	 * The form's create. The list shows the row the form decodes to, joined to
	 * the domain and project it picked; a form the decoder refuses shows
	 * nothing, and the server's field errors do (docs/adr/0087).
	 */
	create: (
		form: FormData,
		opts: { domains: readonly DomainOption[]; projects: readonly ProjectOption[] },
	): Write<"task"> => {
		const parsed = taskForm.read(form);
		return write(
			"task",
			parsed
				? {
						type: "create",
						task: optimisticTaskFromFields(taskFormFields(parsed), opts.domains, opts.projects),
					}
				: { type: "edit", id: crypto.randomUUID() },
			() => createTaskAction(form),
		);
	},
	/** The form's other create: the sentence goes to the parser, the domain as stated. */
	quickAdd: (i: { text: string; domainId: string }, optimistic: TaskRow): Write<"task"> =>
		write("task", { type: "create", task: optimistic }, () => quickAddTaskAction(i)),
	/** The edit waits for the server; the store takes the saved row. */
	update: (id: string, form: FormData): Write<"task"> =>
		write("task", { type: "edit", id }, () => updateTaskAction(id, form)),
};
