import Link from "next/link";
import { Card, Progress } from "@/components/ui";
import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";
import type { ProjectBrief } from "@/lib/services/today";
import { PROGRESS_RENDER } from "@/lib/ui/variant";

/**
 * Active projects, each as a completion figure and a headcount.
 *
 * The ring and the count read the project's own tasks (shape plan §02,
 * decision D2). They used to be different numbers — weighted milestone
 * progress against a plain headcount — because a milestone could carry more
 * weight than its neighbour. Tasks all weigh the same, so the ring is now the
 * count drawn as an arc. The number inside it is what is left, which is the
 * one reading that answers "how much more".
 */
export function ProjectsCard({ projects }: { projects: ProjectBrief[] }) {
	if (projects.length === 0) return null;

	return (
		<section className="t-sec-projects" aria-label="Active projects">
			<Card padding="none" className="px-6 py-5 lg:px-6 lg:py-[22px]">
				<div className="mb-1 flex items-baseline gap-2">
					<h2 className="m-0 type-section text-ink-3">Projects</h2>
					<Link href="/projects" className="font-mono text-meta text-ink-4 hover:text-ink-2">
						All →
					</Link>
				</div>
				<ul>
					{projects.map((p) => {
						const remaining = p.totalCount - p.doneCount;
						const color = isColorSlug(p.color) ? colorSlugVar(p.color) : "var(--ink)";
						return (
							<li key={p.id} className="border-b border-line last:border-b-0">
								<Link
									href={`/projects/${p.id}`}
									className="flex min-h-12 items-center gap-3 py-3 hover:text-accent-ink"
								>
									{/* Same ring on every row, including 0 remaining. A
									    9px dot next to a 34px ring was two systems on
									    one list. The number inside is what is left. */}
									<Progress
										render={PROGRESS_RENDER}
										value={p.progress}
										label={
											p.totalCount === 0
												? `${p.name}: no tasks`
												: `${p.name}: ${p.doneCount} of ${p.totalCount} tasks done`
										}
										color={color}
										size={34}
										thickness={5}
										className={PROGRESS_RENDER === "bar" ? "flex-1" : undefined}
									>
										{remaining}
									</Progress>
									<span className="min-w-0 flex-1 truncate text-base text-ink">{p.name}</span>
									<span className="shrink-0 font-mono text-meta tabular-nums text-ink-4">
										{p.totalCount === 0 ? "No tasks" : `${p.doneCount} of ${p.totalCount} done`}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</Card>
		</section>
	);
}
