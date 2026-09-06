"use client";

import { type ScopeOption, ScopeSelect } from "@/components/ui";

export type TaskStatusFilter = "open" | "overdue" | "today";

export type TaskFilterOption = ScopeOption;

// The null sentinel and the select itself moved to components/ui/scope-select
// when /notes gained the same narrow. Re-exported so the task surfaces that
// already import UNFILED from here keep working.
export { UNFILED } from "@/components/ui";

/**
 * The count line doubles as the status filter — "13 open · 0 overdue · 1 today"
 * is the same information a segmented Open/Done/Overdue control was repeating
 * one row below it, so the counts carry the state instead. There is
 * deliberately no Done filter: nothing pages the done list, so a few hundred
 * completed tasks would render in one go. The Open view's "Recently done" band
 * remains the way finished work is seen.
 *
 * It lives on a bar under the page header rather than in the header's measure
 * slot, and that is the Pass 1 gate decision (.impeccable/mocks/tasks-lab.html,
 * option T2). On eleven surfaces the measure is a readout; here the same phrase
 * is a control, so it sits with the other controls and `/tasks` carries no
 * measure at all. Stated as a rule: **where a page's reading is also its
 * control, the reading goes with the control.**
 */
export function TaskStatusStrip({
	status,
	onStatusChange,
	openCount,
	overdueCount,
	todayCount,
}: {
	status: TaskStatusFilter;
	onStatusChange: (status: TaskStatusFilter) => void;
	openCount: number;
	overdueCount: number;
	todayCount: number;
}) {
	const counts: { value: TaskStatusFilter; count: number; label: string }[] = [
		{ value: "open", count: openCount, label: "open" },
		{ value: "overdue", count: overdueCount, label: "overdue" },
		{ value: "today", count: todayCount, label: "today" },
	];

	return (
		<fieldset className="flex items-center gap-1 font-mono text-meta">
			<legend className="sr-only">Filter tasks</legend>
			{counts.map((c, i) => {
				const active = status === c.value;
				// Overdue keeps its alarm colour when there is something in it, and
				// the active filter is marked by the ink ladder plus a rule. Two
				// different signals on the same word, so they can't share one
				// treatment — and until Pass 1 they shared a colour, which is worse:
				// the rule was `decoration-accent`, so the one orange said "you are
				// here" and "this is late" on the same three words. It is `--ink`
				// now, which leaves the accent on this bar meaning only what it
				// means everywhere else (DESIGN.md, "The One Orange Rule").
				const tone = active
					? "text-ink"
					: c.value === "overdue" && c.count > 0
						? "text-accent-slip"
						: "text-ink-3";
				return (
					<span key={c.value} className="flex items-center gap-1">
						{i > 0 && (
							<span aria-hidden className="text-ink-4">
								·
							</span>
						)}
						<button
							type="button"
							onClick={() => onStatusChange(c.value)}
							aria-pressed={active}
							className={`relative rounded-sm px-0.5 transition-colors after:absolute after:-inset-2 after:content-[''] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${tone} ${
								active ? "underline decoration-ink decoration-2 underline-offset-4" : ""
							}`}
						>
							{c.count} {c.label}
						</button>
					</span>
				);
			})}
		</fieldset>
	);
}

/** Project ∧ domain — two independent narrows over the already-loaded list. */
export function TaskScopeFilters({
	projectId,
	onProjectChange,
	domainId,
	onDomainChange,
	projects,
	domains,
}: {
	projectId: string;
	onProjectChange: (projectId: string) => void;
	domainId: string;
	onDomainChange: (domainId: string) => void;
	projects: TaskFilterOption[];
	domains: TaskFilterOption[];
}) {
	return (
		<div className="flex items-center gap-3">
			<ScopeSelect
				value={projectId}
				onChange={onProjectChange}
				label="Filter by project"
				allLabel="All projects"
				unfiledLabel="No project"
				options={projects}
			/>
			<ScopeSelect
				value={domainId}
				onChange={onDomainChange}
				label="Filter by domain"
				allLabel="All domains"
				unfiledLabel="Unfiled"
				options={domains}
			/>
		</div>
	);
}
