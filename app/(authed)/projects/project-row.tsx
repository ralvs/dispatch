import Link from "next/link";
import type { ReactNode } from "react";
import { ColorDot } from "@/components/color-dot";
import { Badge, ListRow, rowTitle } from "@/components/ui";
import type { ProjectRow } from "@/lib/services/projects";
import type { TaskRow } from "@/lib/services/tasks";
import { projectTypeLabel } from "./constants";

/** Plan O5: open tasks only, up to five, then "+N more". */
const INLINE_TASK_LIMIT = 5;

/**
 * Domain leads left and holds its slot when unassigned — same encoding as
 * task-row / day-row. The project's own colour is not a second dot on the row;
 * two dots of different meaning is what the measured palette exists to prevent
 * (Pass 2 / Gate A lab). Project colour still lives on the detail header.
 *
 * The row carries done/open in place of the milestone percentage, and lists
 * the project's open tasks under it (shape plan §05). A project is a tag for
 * tasks now, so the tasks are the only thing the row can honestly say.
 */
export function ProjectRowItem({
	project,
	openTasks = [],
	doneCount = 0,
	addTask,
}: {
	project: ProjectRow;
	/** The project's open tasks, in list order. Only the first five are drawn. */
	openTasks?: TaskRow[];
	doneCount?: number;
	/** "Add task" on the right — pre-filled and locked to this project (shape plan §06). */
	addTask?: ReactNode;
}) {
	const domainColor = project.domain?.color ?? null;
	const domainName = project.domain?.name ?? "—";
	const total = doneCount + openTasks.length;
	const parts = [
		domainName,
		total > 0 ? `${doneCount}/${total} done` : "No tasks",
		...(project.target_date ? [`Target ${project.target_date}`] : []),
	];
	const shown = openTasks.slice(0, INLINE_TASK_LIMIT);
	const more = openTasks.length - shown.length;

	return (
		<ListRow
			align="start"
			leading={<ColorDot color={domainColor} hold />}
			trailing={
				project.type || addTask ? (
					<div className="flex shrink-0 items-center gap-2">
						{project.type ? <Badge tone="neutral">{projectTypeLabel(project.type)}</Badge> : null}
						{addTask}
					</div>
				) : undefined
			}
		>
			<Link href={`/projects/${project.id}`} className="block min-w-0 hover:text-accent-ink">
				<span className={rowTitle()}>{project.name}</span>
				<p className="mt-0.5 font-mono text-meta text-ink-4">{parts.join(" · ")}</p>
			</Link>
			{shown.length > 0 && (
				<ul className="mt-1.5 space-y-0.5">
					{shown.map((t) => (
						<li key={t.id} className="truncate text-sm text-ink-3">
							<Link href={`/tasks?edit=${t.id}`} className="hover:text-accent-ink">
								{t.title}
							</Link>
						</li>
					))}
					{more > 0 && (
						<li className="font-mono text-meta text-ink-4">
							<Link href={`/tasks?project=${project.id}`} className="hover:text-ink-2">
								+{more} more
							</Link>
						</li>
					)}
				</ul>
			)}
		</ListRow>
	);
}
