"use client";

import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import type { DomainRow } from "@/lib/schemas/domain";
import type { ProjectRow } from "@/lib/schemas/project";
import type { TaskRow } from "@/lib/schemas/task";
import { useAggregate, useClock, useProvisionalIds, useView, viewKey } from "@/lib/store";
import { AddTaskButton } from "./add-task-button";
import { STATUS_GROUPS } from "./constants";
import { ProjectCreateButton } from "./project-form";
import { ProjectRowItem } from "./project-row";

const NO_PROJECTS: ProjectRow[] = [];
const NO_TASKS: TaskRow[] = [];

type Option = { id: string; name: string; domain_id: string };
type DomainOption = { id: string; name: string; color: string | null };

/**
 * /projects from the entity store (#30). The measure, the status groups and
 * each row's open tasks move with every write, with no page render.
 */
export function ProjectList({ domains }: { domains: DomainRow[] }) {
	const projects = useView(viewKey.projects()) ?? NO_PROJECTS;
	const tasks = useView(viewKey.projectBoardTasks()) ?? NO_TASKS;
	const saving = useProvisionalIds("project");
	// The task form only needs a name to pick; the domain options carry colour
	// because the form's Domain select shares them with /tasks. A project still
	// being created is left out: its id is the client's, and no task may carry it.
	const projectOptions: Option[] = projects
		.filter((p) => !saving.has(p.id))
		.map((p) => ({ id: p.id, name: p.name, domain_id: p.domain_id }));
	const domainOptions: DomainOption[] = domains.map((d) => ({
		id: d.id,
		name: d.name,
		color: d.color,
	}));

	return (
		<div>
			<PageHeader
				title="Projects"
				measure={[
					{ count: projects.filter((p) => p.status === "active").length, label: "active" },
					{ count: projects.filter((p) => p.status === "paused").length, label: "paused" },
				]}
				action={<ProjectCreateButton domains={domains} />}
			/>

			{projects.length === 0 ? (
				<EmptyState>No projects yet. Start one.</EmptyState>
			) : (
				// Wrapped so the groups are first children of their own stack —
				// against the page's div the header held that slot and `first:mt-0`
				// never fired (ADR-0046). Empty groups render null, so the first
				// group that survives is the one that loses its margin.
				<div>
					{STATUS_GROUPS.map(({ status, label }) => {
						const group = projects.filter((p) => p.status === status);
						if (group.length === 0) return null;
						return (
							<ListSection key={status} title={label} count={group.length}>
								<ul>
									{group.map((p) => (
										<BoardRow
											key={p.id}
											project={p}
											saving={saving.has(p.id)}
											openTasks={tasks.filter((t) => t.project_id === p.id && t.status !== "done")}
											projectOptions={projectOptions}
											domainOptions={domainOptions}
										/>
									))}
								</ul>
							</ListSection>
						);
					})}
				</div>
			)}
		</div>
	);
}

/**
 * One project row. Its open tasks come from the board's task view — open at
 * read time, plus any added since, minus any finished — and its done count
 * is the store's `project.done:<id>`, which every finish and reopen moves.
 */
function BoardRow({
	project,
	saving,
	openTasks,
	projectOptions,
	domainOptions,
}: {
	project: ProjectRow;
	saving: boolean;
	openTasks: TaskRow[];
	projectOptions: Option[];
	domainOptions: DomainOption[];
}) {
	const doneCount = useAggregate(`project.done:${project.id}`) ?? 0;
	const { todayIso } = useClock();

	return (
		<ProjectRowItem
			project={project}
			saving={saving}
			openTasks={openTasks}
			doneCount={doneCount}
			addTask={
				saving ? undefined : (
					<AddTaskButton
						project={{ id: project.id, name: project.name, domain_id: project.domain_id }}
						domainId={project.domain_id}
						projects={projectOptions}
						domains={domainOptions}
						todayIso={todayIso}
						variant="row"
					/>
				)
			}
		/>
	);
}
