"use client";

import { createTaskAction } from "@/app/(authed)/tasks/actions";
import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import type { DomainRow } from "@/lib/schemas/domain";
import type { ProjectRow } from "@/lib/schemas/project";
import type { TaskRow } from "@/lib/schemas/task";
import { useClock, useProvisionalIds, useStoreWrite, useView, viewKey } from "@/lib/store";
import { optimisticTaskFromForm } from "@/lib/task-interaction/optimistic-task";
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
export function ProjectList({
	domains,
	doneAtRead,
}: {
	domains: DomainRow[];
	/** Done tasks per project when the page was read. */
	doneAtRead: Record<string, number>;
}) {
	const projects = useView(viewKey.projects()) ?? NO_PROJECTS;
	const saving = useProvisionalIds("project");
	// The task form only needs a name to pick; the domain options carry colour
	// because the form's Domain select shares them with /tasks.
	const projectOptions: Option[] = projects.map((p) => ({
		id: p.id,
		name: p.name,
		domain_id: p.domain_id,
	}));
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
											doneAtRead={doneAtRead[p.id] ?? 0}
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
 * One project row. Its tasks are the row's task view: the open tasks at read
 * time, plus any added from this row or finished since — a finished one is
 * counted done here and no longer listed.
 */
function BoardRow({
	project,
	saving,
	doneAtRead,
	projectOptions,
	domainOptions,
}: {
	project: ProjectRow;
	saving: boolean;
	doneAtRead: number;
	projectOptions: Option[];
	domainOptions: DomainOption[];
}) {
	const tasks = useView(viewKey.projectRowTasks(project.id)) ?? NO_TASKS;
	const { todayIso } = useClock();
	const write = useStoreWrite("task");
	const open = tasks.filter((t) => t.status !== "done");
	const doneSince = tasks.length - open.length;

	function createTask(formData: FormData) {
		const optimistic = optimisticTaskFromForm(formData, domainOptions, projectOptions);
		return write({ type: "create", task: optimistic }, () => createTaskAction(formData));
	}

	return (
		<ProjectRowItem
			project={project}
			saving={saving}
			openTasks={open}
			doneCount={doneAtRead + doneSince}
			addTask={
				saving ? undefined : (
					<AddTaskButton
						project={{ id: project.id, name: project.name, domain_id: project.domain_id }}
						domainId={project.domain_id}
						projects={projectOptions}
						domains={domainOptions}
						todayIso={todayIso}
						variant="row"
						onCreate={createTask}
					/>
				)
			}
		/>
	);
}
