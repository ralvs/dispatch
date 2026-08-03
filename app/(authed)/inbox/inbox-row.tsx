"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IconNoteDoc, NOTE_CHIP_CLASS } from "@/components/note-glyphs";
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
						title="View linked note"
						onClick={(e) => e.stopPropagation()}
						className={NOTE_CHIP_CLASS}
					>
						<IconNoteDoc />
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
