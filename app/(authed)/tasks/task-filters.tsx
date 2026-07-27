"use client";

import { CONTROL } from "./task-fields";

export type TaskStatusFilter = "open" | "done" | "overdue";

export const TASK_STATUS_FILTERS: { value: TaskStatusFilter; label: string }[] = [
	{ value: "open", label: "Open" },
	{ value: "done", label: "Done" },
	{ value: "overdue", label: "Overdue" },
];

export type TaskFilterOption = { id: string; name: string };

const FIELD_LABEL = "block font-mono text-eyebrow uppercase text-ink-3";

/**
 * Status / Project / Domain — three independent narrows over the already
 * fully-loaded task list. Filtering happens client-side in task-list.tsx;
 * this component only reports the chosen values.
 */
export function TaskFilters({
	status,
	onStatusChange,
	projectId,
	onProjectChange,
	domainId,
	onDomainChange,
	projects,
	domains,
}: {
	status: TaskStatusFilter;
	onStatusChange: (status: TaskStatusFilter) => void;
	projectId: string;
	onProjectChange: (projectId: string) => void;
	domainId: string;
	onDomainChange: (domainId: string) => void;
	projects: TaskFilterOption[];
	domains: TaskFilterOption[];
}) {
	return (
		<div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
			{/* Same segmented-radio idiom as PriorityPicker in task-fields.tsx:
			    native radios under sr-only, colour reserved for the answer. */}
			<fieldset className="block min-w-0">
				<legend className={FIELD_LABEL}>Status</legend>
				<div
					className="mt-1 inline-flex h-9 overflow-hidden rounded-md border border-line"
					role="radiogroup"
					aria-label="Status"
				>
					{TASK_STATUS_FILTERS.map((f, i) => (
						<label
							key={f.value}
							className={`relative cursor-pointer ${i > 0 ? "border-l border-line" : ""}`}
						>
							<input
								type="radio"
								name="task-status-filter"
								value={f.value}
								checked={status === f.value}
								onChange={() => onStatusChange(f.value)}
								className="peer sr-only"
							/>
							<span className="flex h-full items-center px-3 font-mono text-eyebrow uppercase text-ink-3 transition-colors hover:text-ink peer-checked:bg-accent-bg peer-checked:text-accent-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent">
								{f.label}
							</span>
						</label>
					))}
				</div>
			</fieldset>

			<label className="block min-w-0">
				<span className={FIELD_LABEL}>Project</span>
				<select
					value={projectId}
					onChange={(event) => onProjectChange(event.target.value)}
					aria-label="Filter by project"
					className={`${CONTROL} mt-1 block w-[11rem] max-w-full`}
				>
					<option value="">All projects</option>
					{projects.map((p) => (
						<option key={p.id} value={p.id}>
							{p.name}
						</option>
					))}
				</select>
			</label>

			<label className="block min-w-0">
				<span className={FIELD_LABEL}>Domain</span>
				<select
					value={domainId}
					onChange={(event) => onDomainChange(event.target.value)}
					aria-label="Filter by domain"
					className={`${CONTROL} mt-1 block w-[11rem] max-w-full`}
				>
					<option value="">All domains</option>
					{domains.map((d) => (
						<option key={d.id} value={d.id}>
							{d.name}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
