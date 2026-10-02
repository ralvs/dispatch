"use client";

import { ColorDot } from "@/components/color-dot";
import { EmptyState } from "@/components/ui";
import { assignDomainAction, deleteTaskAction } from "@/lib/actions/tasks";
import type { TaskRow } from "@/lib/services/tasks";
import { useView, viewKey } from "@/lib/store";
import { useTaskIntentRunner } from "@/lib/task-interaction/run-intent";
import { InboxRow } from "./inbox-row";

type DomainOption = { id: string; name: string; color: string | null };

const NO_TASKS: TaskRow[] = [];

/**
 * Reads the inbox from the entity store (#26). Filing or deleting a row is an
 * intent: the row leaves at once, the server's answer confirms it, and a
 * failure puts it back. Filing leaves because the inbox view's scope is
 * "unfiled and open" (lib/store/kinds/task.ts).
 */
export function InboxList({
	domains,
	taskNoteIds,
}: {
	domains: DomainOption[];
	taskNoteIds: Record<string, string>;
}) {
	const rows = useView(viewKey.inbox()) ?? NO_TASKS;
	const removeRun = useTaskIntentRunner("Couldn't delete task.");
	const fileRun = useTaskIntentRunner("Couldn't file task.");

	function remove(task: TaskRow) {
		// Matches the confirm treatment task-row.tsx uses for the same action.
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		removeRun({ type: "delete", id: task.id }, () => deleteTaskAction(task.id));
	}

	function file(task: TaskRow, domainId: string) {
		fileRun({ type: "assign", id: task.id, domainId }, () => assignDomainAction(task.id, domainId));
	}

	if (rows.length === 0) {
		return <EmptyState>The inbox is empty. Well kept.</EmptyState>;
	}

	return (
		<ul className="mt-4">
			{rows.map((t) => (
				<InboxRow
					key={t.id}
					task={t}
					noteId={taskNoteIds[t.id]}
					domainButtons={domains.map((d) => (
						<button
							key={d.id}
							type="button"
							aria-label={`Move ${t.title} to ${d.name}`}
							onClick={() => file(t, d.id)}
							className="inline-flex h-7 items-center gap-1.5 rounded-control border border-line px-2 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
						>
							<ColorDot color={d.color} />
							{d.name}
						</button>
					))}
					onDelete={() => remove(t)}
				/>
			))}
		</ul>
	);
}
