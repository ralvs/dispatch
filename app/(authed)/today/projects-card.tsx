import Link from "next/link";
import { Card, Progress } from "@/components/ui";
import { colorSlugVar, isColorSlug } from "@/lib/schemas/color";
import type { ProjectBrief } from "@/lib/services/today";
import { PROGRESS_RENDER } from "@/lib/ui/variant";

/**
 * Active projects, each as a completion figure and a headcount.
 *
 * The ring is the weighted milestone progress and the count beside it is the
 * plain "9 of 14 done" — they are different numbers on purpose. Weight is what
 * makes progress honest when milestones are unequal; the count is what a
 * person can actually check. The number inside the ring is what is left, which
 * is the only one of the three that answers "how much more".
 */
export function ProjectsCard({ projects }: { projects: ProjectBrief[] }) {
	if (projects.length === 0) return null;

	return (
		<section className="t-sec-projects" aria-label="Active projects">
			<Card padding="none" className="px-6 py-5 lg:px-6 lg:py-[22px]">
				<div className="mb-1 flex items-baseline justify-between gap-4">
					<h2 className="m-0 type-section text-ink">Projects</h2>
					<Link href="/projects" className="font-mono text-meta text-ink-3 hover:text-ink-2">
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
									{/* A ring at 0% on a project with no milestones is not a
									    reading, it is furniture — it says "nothing done" about a
									    thing that has nothing to do. The project keeps its
									    colour as a dot and the row says so in words. */}
									{p.totalCount === 0 ? (
										<span
											aria-hidden="true"
											className="inline-block size-[9px] shrink-0 rounded-full"
											style={{ background: color }}
										/>
									) : (
										<Progress
											render={PROGRESS_RENDER}
											value={p.progress}
											label={`${p.name}: ${p.doneCount} of ${p.totalCount} milestones done`}
											color={color}
											size={34}
											thickness={5}
											className={PROGRESS_RENDER === "bar" ? "flex-1" : undefined}
										>
											{remaining > 0 ? remaining : null}
										</Progress>
									)}
									<span className="min-w-0 flex-1 truncate text-base text-ink">{p.name}</span>
									<span className="shrink-0 font-mono text-meta tabular-nums text-ink-4">
										{p.totalCount === 0
											? "No milestones"
											: `${p.doneCount} of ${p.totalCount} done`}
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
