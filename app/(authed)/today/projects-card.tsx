import Link from "next/link";
import type { ProjectBrief } from "@/lib/services/briefing";

export function ProjectsCard({ projects }: { projects: ProjectBrief[] }) {
	if (projects.length === 0) return null;

	return (
		<section className="mt-8" aria-label="Active projects">
			<div className="flex items-baseline justify-between">
				<h2 className="font-mono text-eyebrow uppercase tracking-widest text-ink-3">
					Projects · {projects.length} active
				</h2>
				<Link href="/projects" className="font-mono text-meta text-ink-4 hover:text-ink-2">
					All →
				</Link>
			</div>
			<ul className="mt-2">
				{projects.map((p) => (
					<li key={p.id} className="border-b border-line py-2.5">
						<Link href={`/projects/${p.id}`} className="block">
							<div className="flex items-baseline justify-between gap-3">
								<span className="min-w-0 flex-1 truncate text-sm text-ink">{p.name}</span>
								<span className="font-mono text-meta tabular-nums text-ink-3">
									{Math.round(p.progress * 100)}%
								</span>
							</div>
							{p.nextMilestone && (
								<p className="mt-0.5 truncate font-mono text-meta text-ink-4">
									Next · {p.nextMilestone.title}
								</p>
							)}
						</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
