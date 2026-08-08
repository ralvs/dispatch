import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import { Badge } from "@/components/ui";
import type { ProjectRow } from "@/lib/services/projects";
import { projectTypeLabel } from "./constants";

export function ProjectRowItem({ project }: { project: ProjectRow }) {
	return (
		<li className="hairline py-3">
			<Link href={`/projects/${project.id}`} className="flex items-center justify-between gap-3">
				<span className="flex min-w-0 items-center gap-2">
					<ColorDot color={project.color} />
					<span className="min-w-0 truncate type-title text-base text-ink">{project.name}</span>
				</span>
				{project.type && <Badge tone="neutral">{projectTypeLabel(project.type)}</Badge>}
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
