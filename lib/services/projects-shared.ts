import type { MilestoneRow } from "@/lib/services/projects";

/**
 * Weighted completion fraction (0..1). Client-safe: pure math shared between
 * the server-only projects service and client components.
 */
export function milestoneProgress(milestones: Pick<MilestoneRow, "status" | "weight">[]): number {
	const total = milestones.reduce((sum, m) => sum + m.weight, 0);
	if (total === 0) return 0;
	const done = milestones.filter((m) => m.status === "done").reduce((sum, m) => sum + m.weight, 0);
	return done / total;
}
