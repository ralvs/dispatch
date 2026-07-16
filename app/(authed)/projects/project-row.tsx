import Link from "next/link";
import type { ProjectRow } from "@/lib/services/projects";

export function ProjectRowItem({ project }: { project: ProjectRow }) {
	return (
		<li className="hairline py-3">
			<Link href={`/projects/${project.id}`} className="flex items-baseline justify-between gap-3">
				<span className="flex items-center gap-2">
					{project.color && (
						<span
							aria-hidden="true"
							className="inline-block size-2.5 rounded-full"
							style={{ backgroundColor: project.color }}
						/>
					)}
					<span className="font-serif text-base text-ink">{project.name}</span>
				</span>
				{project.type && (
					<span className="shrink-0 border border-line px-1.5 py-0.5 font-mono text-meta uppercase tracking-widest text-ink-3">
						{project.type}
					</span>
				)}
			</Link>
			{project.target_date && (
				<p className="mt-0.5 text-meta text-ink-4">Target {project.target_date}</p>
			)}
		</li>
	);
}
