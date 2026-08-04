"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
						<Icon icon={FileText} size="sm" />
					</Link>
				)}
			</p>
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				{domainButtons}
				<Button
					type="button"
					variant="danger"
					size="sm"
					className="ml-auto"
					onClick={onDelete}
					aria-label={`Delete task "${task.title}"`}
				>
					Delete
				</Button>
			</div>
		</li>
	);
}
