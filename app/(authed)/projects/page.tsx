import { EmptyState, PageHeader, SectionHead } from "@/components/ui";
import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { STATUS_GROUPS } from "./constants";
import { ProjectCreateButton } from "./project-form";
import { ProjectRowItem } from "./project-row";

export default async function ProjectsPage() {
	const { sb } = await requireOwnerPage();
	const [projects, domains] = await Promise.all([
		listProjects(sb),
		listDomains(sb, { includeArchived: true }),
	]);

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
							<section key={status} className="mt-9 first:mt-0" aria-label={label}>
								<SectionHead title={label} aside={String(group.length)} />
								<ul>
									{group.map((p) => (
										<ProjectRowItem key={p.id} project={p} />
									))}
								</ul>
							</section>
						);
					})}
				</div>
			)}
		</div>
	);
}
