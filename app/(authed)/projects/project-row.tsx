import Link from "next/link";
import { ColorDot } from "@/components/color-dot";
import { Badge, ListRow, rowTitle } from "@/components/ui";
import type { ProjectRow } from "@/lib/services/projects";
import { projectTypeLabel } from "./constants";

/**
 * Domain leads left and holds its slot when unassigned — same encoding as
 * task-row / day-row. The project's own colour is not a second dot on the row;
 * two dots of different meaning is what the measured palette exists to prevent
 * (Pass 2 / Gate A lab). Project colour still lives on the detail header.
 */
export function ProjectRowItem({ project }: { project: ProjectRow }) {
	const domainColor = project.domain?.color ?? null;
	const domainName = project.domain?.name ?? "—";
	const meta = project.target_date ? `${domainName} · Target ${project.target_date}` : domainName;

	return (
		<ListRow
			leading={<ColorDot color={domainColor} hold />}
			trailing={
				project.type ? <Badge tone="neutral">{projectTypeLabel(project.type)}</Badge> : undefined
			}
		>
			<Link href={`/projects/${project.id}`} className="block min-w-0 hover:text-accent-ink">
				<span className={rowTitle()}>{project.name}</span>
				<p className="mt-0.5 font-mono text-meta text-ink-4">{meta}</p>
			</Link>
		</ListRow>
	);
}
