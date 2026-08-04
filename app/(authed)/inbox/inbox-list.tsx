"use client";

import { useOptimistic, useTransition } from "react";
import { assignDomainAction, deleteTaskAction } from "@/app/(authed)/tasks/actions";
import { ColorDot } from "@/components/color-dot";
import { runAction } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/services/tasks";
import { InboxRow } from "./inbox-row";

type DomainOption = { id: string; name: string; color: string | null };

/**
 * Owns useOptimistic so filing or deleting a row removes it immediately —
 * no wait for the inbox RSC revalidation.
 */
export function InboxList({
	tasks,
	domains,
	taskNoteIds,
}: {
	tasks: TaskRow[];
	domains: DomainOption[];
	taskNoteIds: Record<string, string>;
}) {
	const [, startTransition] = useTransition();
	const [rows, removeOptimistic] = useOptimistic(tasks, (current, id: string) =>
		current.filter((t) => t.id !== id),
	);

	function remove(task: TaskRow) {
		// Matches the confirm treatment task-row.tsx uses for the same action.
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		startTransition(async () => {
			removeOptimistic(task.id);
			await runAction(() => deleteTaskAction(task.id), "Couldn't delete task.");
		});
	}

	function file(task: TaskRow, domainId: string) {
		startTransition(async () => {
			removeOptimistic(task.id);
			await runAction(() => assignDomainAction(task.id, domainId), "Couldn't file task.");
		});
	}

	if (rows.length === 0) {
		return (
			<p className="py-10 text-center font-serif italic text-ink-3">
				The inbox is empty. Well kept.
			</p>
		);
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
