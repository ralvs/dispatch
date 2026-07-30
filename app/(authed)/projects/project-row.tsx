import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import type { ProjectRow } from "@/lib/services/projects";
import { projectTypeLabel } from "./constants";

export function ProjectRowItem({ project }: { project: ProjectRow }) {
	return (
		<li className="hairline py-3">
			<Link href={`/projects/${project.id}`} className="flex items-baseline justify-between gap-3">
				<span className="flex min-w-0 items-center gap-2">
					<ColorDot color={project.color} />
					<span className="min-w-0 truncate font-serif text-base text-ink">{project.name}</span>
				</span>
				{project.type && (
					<span className="shrink-0 rounded-md border border-line px-1.5 py-0.5 font-mono text-meta uppercase tracking-widest text-ink-3">
						{projectTypeLabel(project.type)}
					</span>
				)}
			</Link>
			<p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 font-mono text-meta text-ink-4">
				<span className="inline-flex items-center gap-1">
					<ColorDot color={project.domain?.color} />
					{project.domain?.name ?? "—"}
				</span>
				{project.target_date && ` · Target ${project.target_date}`}
			</p>
		</li>
	);
}
