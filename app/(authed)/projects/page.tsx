import { EmptyState, ListSection, PageHeader } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { getCachedDomains } from "@/lib/cache/domains";
import { getCachedProjectBoard } from "@/lib/cache/projects";
import { getCachedAppTimezone } from "@/lib/cache/settings";
import { todayInTz } from "@/lib/dates";
import { AddTaskButton } from "./add-task-button";
import { STATUS_GROUPS } from "./constants";
import { ProjectCreateButton } from "./project-form";
import { ProjectRowItem } from "./project-row";

export default async function ProjectsPage() {
	// Security boundary first (iron rule #2) — the cached reads use the
	// service-role client.
	await requireOwnerPage();
	// Open tasks for the inline lists (plan O5) come with the board: one read
	// for the whole page rather than one per row.
	const [{ projects, openTasks, taskCounts }, domains, tz] = await Promise.all([
		getCachedProjectBoard(),
		getCachedDomains(true),
		getCachedAppTimezone(),
	]);

	// The task form only needs a name to pick; the domain options carry colour
	// because the form's Domain select shares them with /tasks.
	const projectOptions = projects.map((p) => ({ id: p.id, name: p.name, domain_id: p.domain_id }));
	const domainOptions = domains.map((d) => ({ id: d.id, name: d.name, color: d.color }));
	const todayIso = todayInTz(tz);

	const openByProject = new Map<string, typeof openTasks>();
	for (const task of openTasks) {
		if (task.project_id === null) continue;
		const bucket = openByProject.get(task.project_id);
		if (bucket) bucket.push(task);
		else openByProject.set(task.project_id, [task]);
	}

	return (
		<div>
			<PageHeader
				title="Projects"
				// Two .filter passes for the measure (plus one per status group
				// below) is fine: server component, once per request, small array.
				// A counts-map reduce costs more readability than it buys.
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
										<ProjectRowItem
											key={p.id}
											project={p}
											openTasks={openByProject.get(p.id) ?? []}
											doneCount={taskCounts[p.id]?.done ?? 0}
											addTask={
												<AddTaskButton
													project={{ id: p.id, name: p.name, domain_id: p.domain_id }}
													domainId={p.domain_id}
													projects={projectOptions}
													domains={domainOptions}
													todayIso={todayIso}
													variant="row"
												/>
											}
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
