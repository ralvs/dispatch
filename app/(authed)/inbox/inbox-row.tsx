"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TaskRow } from "@/lib/services/tasks";

export function InboxRow({
	task,
	noteId,
	domainButtons,
	onDelete,
}: {
	task: TaskRow;
	/** Linked note id, if any — renders the same quiet chip the Tasks list uses. */
	noteId?: string;
	domainButtons: ReactNode;
	onDelete: () => void;
}) {
	return (
		<li className="hairline py-3">
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
				{domainButtons}
				<button
					type="button"
					onClick={onDelete}
					aria-label={`Delete task "${task.title}"`}
					className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 font-mono text-eyebrow uppercase tracking-widest text-error hover:border-error active:opacity-70"
				>
					Delete
				</button>
			</div>
		</li>
	);
}
