"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ListRow, ROW_TITLE_CLASS } from "@/components/ui";
import { NOTE_CHIP_CLASS } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { TaskRow } from "@/lib/services/tasks";

/**
 * The third rendering of a task — title, note chip, domain buttons.
 *
 * Stays separate from TaskRowItem on purpose. That row is built around a meta
 * line, a priority ring, a star and an edit dialog; none of that is the inbox's
 * job. Filing is one-way (ADR-0024): give a domain and the row leaves. The
 * optimistic removal in inbox-list.tsx is behaviour this pass does not touch.
 *
 * What converges is encoding: ListRow geometry, name at 400, note chip class.
 */
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
		<ListRow align="start">
			<p className="flex min-w-0 items-center gap-1.5">
				<span className={ROW_TITLE_CLASS}>{task.title}</span>
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
		</ListRow>
	);
}
