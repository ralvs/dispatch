import { requireOwnerPage } from "@/lib/auth";
import { listDomains } from "@/lib/services/domains";
import { listProjects } from "@/lib/services/projects";
import { STATUS_GROUPS } from "./constants";
import { ProjectForm } from "./project-form";
import { ProjectRowItem } from "./project-row";

export default async function ProjectsPage() {
	const { sb } = await requireOwnerPage();
	const [projects, domains] = await Promise.all([
		listProjects(sb),
		listDomains(sb, { includeArchived: true }),
	]);

	return (
		<div>
			<header className="hairline-strong pb-4">
				<p className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">Projects</p>
				<h1 className="mt-1 font-serif text-3xl text-ink">What's in motion</h1>
			</header>

			<section className="mt-6">
				<ProjectForm domains={domains} />
			</section>

			{projects.length === 0 ? (
				<p className="py-8 text-center font-serif italic text-ink-3">No projects yet. Start one.</p>
			) : (
				STATUS_GROUPS.map(({ status, label }) => {
					const group = projects.filter((p) => p.status === status);
					if (group.length === 0) return null;
					return (
						<section key={status} className="mt-8" aria-label={label}>
							<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-4">
								{label}
							</h2>
							<ul className="mt-2">
								{group.map((p) => (
									<ProjectRowItem key={p.id} project={p} />
								))}
							</ul>
						</section>
					);
				})
			)}
		</div>
	);
}
