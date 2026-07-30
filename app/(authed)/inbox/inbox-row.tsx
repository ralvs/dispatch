"use client";

import Link from "next/link";
import { useTransition } from "react";
import { assignDomainAction, deleteTaskAction } from "@/app/(authed)/tasks/actions";
import { ColorDot } from "@/components/color-dot";
import { runAction } from "@/lib/client/toast";
import type { TaskRow } from "@/lib/services/tasks";

type DomainOption = { id: string; name: string; color: string | null };

export function InboxRow({
	task,
	domains,
	noteId,
}: {
	task: TaskRow;
	domains: DomainOption[];
	/** Linked note id, if any — renders the same quiet chip the Tasks list uses. */
	noteId?: string;
}) {
	const [pending, startTransition] = useTransition();
	// Every domain is a valid destination now — the inbox is the absence of one,
	// so there is nothing to filter out. Filing stays one-way because no write
	// path sets domain_id back to null (docs/adr/0027).

	function remove() {
		// Matches the confirm treatment task-row.tsx uses for the same action.
		if (!window.confirm(`Delete "${task.title}"?`)) return;
		startTransition(async () => {
			await runAction(() => deleteTaskAction(task.id), "Couldn't delete task.");
		});
	}

	return (
		<li className={`hairline py-3 ${pending ? "opacity-50" : ""}`}>
			<p className="flex min-w-0 items-center gap-1.5 font-serif text-base text-ink">
				<span className="min-w-0 truncate">{task.title}</span>
				{noteId && (
					<Link
						href={`/notes/${noteId}`}
						aria-label="View linked note"
						onClick={(e) => e.stopPropagation()}
						// Vertical reach kept smaller than the ideal 44px: this chip sits
						// beside a truncating title with no row-gap beneath it.
						className="relative inline-flex shrink-0 items-center gap-1 rounded border border-line px-1 py-px text-[10px] leading-none text-ink-3 after:absolute after:-inset-y-3 after:-inset-x-1 after:content-[''] hover:border-line-strong hover:text-ink active:opacity-70"
					>
						<span aria-hidden="true">¶</span> Note
					</Link>
				)}
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				{domains.map((d) => (
					<button
						key={d.id}
						type="button"
						disabled={pending}
						// Without this the accessible name is the bare domain name, which
						// reads as an unattached list of words to a screen reader.
						aria-label={`Move ${task.title} to ${d.name}`}
						onClick={() =>
							startTransition(async () => {
								await runAction(() => assignDomainAction(task.id, d.id), "Couldn't file task.");
							})
						}
						className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-ink-3 hover:border-line-strong hover:text-ink active:opacity-70"
					>
						<ColorDot color={d.color} />
						{d.name}
					</button>
				))}
				<button
					type="button"
					disabled={pending}
					onClick={remove}
					aria-label={`Delete task "${task.title}"`}
					className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-error hover:border-error active:opacity-70"
				>
					Delete
				</button>
			</div>
		</li>
	);
}
